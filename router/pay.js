const express = require('express');
const axios = require('axios');
const router = express.Router();
const {savePending}=require('./pending');
const microtikSchema = require('../router/microtikSchema');


// FIXED: Converted from a route handler into proper Express middleware using `next`
const getData = async (req, res, next) => {
    try {
        // MATCHING YOUR .env KEYS:
        const consumerKey = process.env.DARAJATOR_CONSUMER_KEY;
        const consumerSecret = process.env.DARAJATOR_CONSUMER_SECRET;  
        const token = Buffer.from(`${consumerKey}:${consumerSecret}`, 'utf8').toString('base64');
        const response = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${token}`
            }
        });
        req.accessToken = response.data.access_token;
        next();
    } catch (error) {
        console.error('Error fetching token:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to authenticate with M-Pesa' });
    }
};
router.post('/pay', getData, async (req, res) => {
    try {
        const { phone, planName, planPrice,macAddress } = req.body;
        
        if (!phone || !planName || !planPrice) {
            return res.status(400).json({ error: "Missing required payment fields" });
        }

        const accessToken = req.accessToken; 
    
        
        // Clean numeric price safely
        const numericPrice = Number(String(planPrice).replace(/[^\d]/g, ''));
        if (!numericPrice || isNaN(numericPrice)) {
            return res.status(400).json({ error: "Invalid package price format" });
        }
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.slice(1);
        }

        const date = new Date();
        const timestamp = date.getFullYear() +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0') +
            String(date.getHours()).padStart(2, '0') +
            String(date.getMinutes()).padStart(2, '0') +
            String(date.getSeconds()).padStart(2, '0');

        const shortcode = process.env.DARAJATOR_SHORTCODE;
        const passkey = process.env.DARAJATOR_PASSKEY;
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        // Call Safaricom Sandbox STK Push
      const response = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerBuyGoodsOnline", // Change to "CustomerBuyGoodsOnline" if it's a Till number
    Amount: numericPrice,
    PartyA: formattedPhone,
    PartyB: process.env.DARAJATOR_STORE_SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: process.env.DARAJATOR_CALLBACK_URL,
    AccountReference:`${process.env.TRANSACTION_DESC} for ${planName}`,
    TransactionDesc: `Payment for ${planName}`
}, { 
    headers: { Authorization: `Bearer ${accessToken}` } 
});

        const checkoutRequestId = response.data.CheckoutRequestID;
       const schema= await microtikSchema.create(
        {
            checkoutRequestID:checkoutRequestId,
            macAddress: macAddress,
            phoneNumber: phone,
            planName: planName, // e.g., "2min", "1hr", "1day"
            status: 'PENDING'
        }
       );
// savePending(checkoutRequestId, {
//     macAddress: macAddress,
//     phone: phone,
//     planName: planName, // e.g., "2min", "1hr", "1day"
//     status: 'PENDING'
//     // DO NOT calculate 'expires' here!
// });
        // Save to MongoDB as Pending
        // await microtikModel.create({
        //     macAddress: macAddress,
        //     phoneNumber: formattedPhone,
        //     checkoutRequestID: checkoutRequestId,
        //     status: 'Pending',
        //     createdAt: new Date(),
        //     expires: expires
        // });

        return res.status(200).json({ 
            success: true, 
            Message: 'STK push sent. Check your phone.', 
            checkoutRequestId: checkoutRequestId 
        });

    } catch (error) {
        // Safe error logging that won't crash Node if response data is missing
        const errorMsg = error.response?.data?.errorMessage || error.response?.data?.safaricomResponseMessage || error.message;
        console.error('Error processing payment:', errorMsg);
        
        return res.status(500).json({ 
            success: false, 
            error: errorMsg || 'Failed to process payment' 
        });
    }
});


module.exports = router;
