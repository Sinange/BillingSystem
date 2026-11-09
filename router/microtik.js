const express = require('express');
const axios = require('axios');
const router = express.Router();
const microtikSchema = require('../router/microtikSchema');
const { getPending, removePending, getAllPending ,updateStatus} = require('./pending');


// Helper configuration for MikroTik REST API
const routerHost = process.env.MIKROTIK_HOST;
// REST API typically runs on HTTP port 80 (or your configured Web port)
const routerPort = process.env.MIKROTIK_REST_PORT || '80'; 
const baseURL = `http://${routerHost}:${routerPort}/rest`;

const auth = {
    username: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASSWORD
};
function getExpiry(planName) {
    if (!planName) return new Date(Date.now() + 60 * 60 * 1000); // Safe fallback to 1 hour
    const name = String(planName).trim().toLowerCase();
    const now = new Date();

    let expiryTime = new Date(now.getTime() + 60 * 60 * 1000); // Default 1 hour

    if (name.includes('min')) {
        const match = name.match(/(\d+)/);
        const minutes = match ? parseInt(match[1]) : 30;
        expiryTime = new Date(now.getTime() + minutes * 60 * 1000);
    } 
    else if (name.includes('hour') || name.includes('hr')) {
        const match = name.match(/(\d+)/);
        const hours = match ? parseInt(match[1]) : 1;
        expiryTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
    } 
    else if (name.includes('day')) {
        const match = name.match(/(\d+)/);
        const days = match ? parseInt(match[1]) : 1;
        expiryTime = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }
    else if (name.includes('month') || name.includes('mth')) {
        const match = name.match(/(\d+)/);
        const months = match ? parseInt(match[1]) : 1;
        expiryTime = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    }

    console.log(`Package: "${planName}" -> Expiry Set To: ${expiryTime}`);
    return expiryTime;
}

// ==================== 1. PAYMENT CALLBACK (GRANT ACCESS) ====================
router.post('/callback', async (req, res) => {
    try {
        const callbackData = req.body?.Body?.stkCallback; 
        const resultCode = callbackData.ResultCode;
        const checkoutRequestID = callbackData.CheckoutRequestID;

        if (resultCode === 0) {
            console.log('Payment successful:', callbackData);
            const record=await microtikSchema.findOne({checkoutRequestID:checkoutRequestID})
            // const record = getPending(checkoutRequestID);
            if (!record || !record.macAddress) {
                console.error('Error: MAC address not found for CheckoutRequestID:', checkoutRequestID);
                return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
            }

            const clientMac = record.macAddress;
            const metadata = callbackData.CallbackMetadata.Item;
            const mpesaReceiptNumber = metadata.find(o => o.Name === 'MpesaReceiptNumber')?.Value;
            const amountPaid = metadata.find(o => o.Name === 'Amount')?.Value;
            const phoneNumber = metadata.find(o => o.Name === 'PhoneNumber')?.Value;
            const expires = getExpiry(record.planName) || new Date(Date.now() + 60 * 60 * 1000);
            // 1. Mark status as SUCCESS now that variables exist
            record.status="SUCCESS"
            record.mpesaReceiptNumber=mpesaReceiptNumber;
            record.expires=expires;
            const save=await record.save();
        //    updateStatus(checkoutRequestID, { 
        //         status: 'SUCCESS', 
        //         mpesaReceiptNumber:mpesaReceiptNumber, 
        //         expires: expires
        //     });

           try {
                // 2. Grant access on MikroTik via REST API
                await axios.post(`${baseURL}/ip/hotspot/ip-binding/add`, {
                    'mac-address': clientMac,
                    'type': 'bypassed',
                    'comment': `Paid via M-Pesa:${amountPaid} ${mpesaReceiptNumber} (${phoneNumber})`
                }, { auth });

                console.log('User granted access on MikroTik successfully for MAC:', clientMac);
            } catch (routerError) {
                console.error('MikroTik REST API Error (Grant Access):', routerError.response?.data || routerError.message);
            }
        } else {
            console.log('Payment failed or cancelled:', callbackData);
        } 

        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (error) {
        console.error('Error handling callback:', error.message);
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});
router.get('/status/:checkoutId',async (req, res) => {
    const { checkoutId } = req.params;
       const record = await microtikSchema.findOne({checkoutRequestID:checkoutId});
    // const record = getPending(checkoutId);

    if (!record) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (record.status === 'SUCCESS') {
        return res.json({ success: true, status: 'SUCCESS' });
    }

    return res.json({ success: false, status: 'PENDING' });
});
// Get all transactions (or filter by MAC address if passed as query parameter)
router.get('/transactions', async (req, res) => {
    try {
        const { mac } = req.query;
        let query = {};
        if (mac) {
            query.macAddress = mac.toUpperCase();
        }
        console.log(mac);
        
        // Fetch from MongoDB, sorted by newest first
        const sessions = await microtikSchema.find(query).sort({ createdAt: -1 }).limit(50);
        return res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
});
// ==================== 2. BACKGROUND EXPIRATION CHECKER ====================
setInterval(async () => {
    try {
        // const records = getAllPending();
        const now = new Date();
        const records = await microtikSchema.find( {
            status:"SUCCESS",
            expires: { $lte: now }
        });

        for (const record of records) {
                const searchMac = record.macAddress ? record.macAddress.toUpperCase() : '';
                console.log(`⏰ Plan expired for MAC: ${searchMac}. Processing removal...`);

                try {
                    // 1. Find and Remove IP Binding Bypass
                    const bindingsRes = await axios.get(`${baseURL}/ip/hotspot/ip-binding`, { auth });
                    const targetBinding = (bindingsRes.data || []).find(b => 
                        (b['mac-address'] || '').toUpperCase() === searchMac
                    );

                    if (targetBinding && targetBinding['.id']) {
                        await axios.delete(`${baseURL}/ip/hotspot/ip-binding/${targetBinding['.id']}`, { auth });
                        console.log(`✅ Successfully removed IP binding for MAC: ${searchMac}`);
                    }

                    // 2. Find and Terminate Active Hotspot Session
                    const activeRes = await axios.get(`${baseURL}/ip/hotspot/active`, { auth });
                    const targetSession = (activeRes.data || []).find(s => 
                        (s['mac-address'] || '').toUpperCase() === searchMac
                    );

                    if (targetSession && targetSession['.id']) {
                        await axios.delete(`${baseURL}/ip/hotspot/active/${targetSession['.id']}`, { auth });
                        console.log(`✅ Successfully terminated active session for MAC: ${searchMac}`);
                    }

                    // 3. Find and Remove from Hotspot Host Table
                    const hostsRes = await axios.get(`${baseURL}/ip/hotspot/host`, { auth });
                    const targetHost = (hostsRes.data || []).find(h => 
                        (h['mac-address'] || '').toUpperCase() === searchMac
                    );

                    if (targetHost && targetHost['.id']) {
                        await axios.delete(`${baseURL}/ip/hotspot/host/${targetHost['.id']}`, { auth });
                        console.log(`✅ Successfully removed host entry for MAC: ${searchMac}`);
                    }

                } catch (routerErr) {
                    console.error('Router cleanup operation warning:', routerErr.response?.data || routerErr.message);
                } finally {
                    // Clean up local record regardless of router response
                    // removePending(checkoutId);
                    record.status = 'EXPIRED';
                        await record.save();
                    console.log(`🗑️ Cleaned up record for checkout ID: ${record.checkoutRequestID}`);
            }
        }
    } catch (error) {
        console.error('Error in expiration checker background job:', error.message);
    }
}, 60 * 1000);

module.exports = router;
