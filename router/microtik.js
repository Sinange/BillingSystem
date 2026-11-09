const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const microtikSchema = require('../router/microtikSchema');

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

function requireRouterToken(req, res, next) {
    const expectedToken = process.env.MIKROTIK_SYNC_TOKEN;
    const providedToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!expectedToken) {
        return res.status(503).json({ success: false, error: 'Router sync is not configured' });
    }

    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken || '');
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    next();
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

            const metadata = callbackData.CallbackMetadata.Item;
            const mpesaReceiptNumber = metadata.find(o => o.Name === 'MpesaReceiptNumber')?.Value;
            const expires = getExpiry(record.planName) || new Date(Date.now() + 60 * 60 * 1000);
            record.status = 'SUCCESS';
            record.mpesaReceiptNumber = mpesaReceiptNumber;
            record.expires = expires;
            await record.save();
            console.log('Payment saved; MikroTik will retrieve it from the router sync endpoint:', checkoutRequestID);
        } else {
            console.log('Payment failed or cancelled:', callbackData);
        } 

        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (error) {
        console.error('Error handling callback:', error.message);
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});

router.get('/router/pending', requireRouterToken, async (req, res) => {
    try {
        const now = new Date();
        const records = await microtikSchema.find({
            status: { $in: ['SUCCESS', 'EXPIRED'] },
            $or: [
                { expires: { $gt: now }, routerAppliedAt: { $exists: false } },
                { expires: { $lte: now }, routerExpiredAt: { $exists: false } }
            ]
        }).sort({ createdAt: 1 }).limit(50);

        return res.json(records.map(record => ({
            checkoutRequestID: record.checkoutRequestID,
            macAddress: record.macAddress,
            action: record.expires <= now ? 'expire' : 'grant'
        })));
    } catch (error) {
        console.error('Error fetching router sync actions:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch router actions' });
    }
});

router.post('/router/ack', requireRouterToken, async (req, res) => {
    try {
        const { checkoutRequestID, action } = req.body || {};
        if (typeof checkoutRequestID !== 'string' || !['grant', 'expire'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid acknowledgment' });
        }

        const record = await microtikSchema.findOne({ checkoutRequestID });
        if (!record) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }

        const now = new Date();
        if (action === 'grant') {
            if (record.routerAppliedAt) return res.json({ success: true });
            if (record.status !== 'SUCCESS' || !record.expires || record.expires <= now) {
                return res.status(409).json({ success: false, error: 'Grant is no longer pending' });
            }
            record.routerAppliedAt = now;
        } else {
            if (record.routerExpiredAt) return res.json({ success: true });
            if (!record.expires || record.expires > now) {
                return res.status(409).json({ success: false, error: 'Expiry is not due' });
            }
            record.routerExpiredAt = now;
            record.status = 'EXPIRED';
        }

        await record.save();
        return res.json({ success: true });
    } catch (error) {
        console.error('Error acknowledging router sync action:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to acknowledge router action' });
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
module.exports = router;
