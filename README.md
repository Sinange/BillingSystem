# Billing System

A web-based billing hotspot application for  free.

## Overview

This project helps businesses have a clean billing workflow through a simple web interface.

## Features
- ProductPurchasing
- Past Transaction management

4. Create a `.env` file in the root directory and add the required variables:

```env
PORT=3000
DARAJATOR_CONSUMER_SECRET=
DARAJATOR_CONSUMER_KEY=
DARAJATOR_PASSKEY=
DARAJATOR_CALLBACK_URL=
TRANSACTION_DESC=
DARAJATOR_SHORTCODE=
MIKROTIK_SYNC_TOKEN=use-a-long-random-secret
MONGO_URI=mongodb+srv://...
```
i wanted to use a live url  i fortunately discovered  because network restrictions i decided to  switch routeros script removed this code in
[microtik.js]<a href="/router/microtik.js>View code></a>
```

// Helper configuration for MikroTik REST API
const routerHost = process.env.MIKROTIK_HOST;
// REST API typically runs on HTTP port 80 (or your configured Web port)
const routerPort = process.env.MIKROTIK_REST_PORT || '80'; 
const baseURL = `http://${routerHost}:${routerPort}/rest`;

const auth = {
    username: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASSWORD
};
//this too
   const clientMac = record.macAddress;
               const amountPaid = metadata.find(o => o.Name === 'Amount')?.Value;
                       const phoneNumber = metadata.find(o => o.Name === 'PhoneNumber')?.Value;


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
            // background disconection checker too
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
```
## MikroTik on Render

Render cannot connect to a router's private LAN address. Instead, the payment callback saves the successful transaction, and the MikroTik polls the app over HTTPS for actions to grant or expire access.

1. Set `MIKROTIK_SYNC_TOKEN` in Render to a long, unique secret. Set the same value in the RouterOS script; do not use your MikroTik administrator password as this token.
you get that by using
```terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
2. On the MikroTik, import or paste the commands in [`routeros-sync.rsc`](routeros-sync.rsc). Replace `REPLACE_WITH_LONG_RANDOM_TOKEN` with the token from Render.
3. The script runs every 10 seconds. Ensure the router has DNS and HTTPS access to `billingsystem-v6r7.onrender.com`, and that its clock is correct for TLS.

The script requires RouterOS v7. For better isolation, create a dedicated RouterOS user/policy for the script rather than using the router administrator account. The router polls for paid transactions and acknowledges an action only after applying it, so temporary connectivity failures leave the action available for retry.

5. Start the application:

```bash
npm run dev
```


## Usage

- Open the app in your browser at:
  `http://localhost:3000`
-  Use vscode tunnel if you dont have a server  and set port  fowarding to `3000` and  replace this lines in
  `[index.js]`<a href="/public/index.js" >View Code </a> this line `https://hm85s7nf-3000.eun1.devtunnels.ms` with  your tunnel  or `yoursite.com` link

```where they appear
DARAJATOR_CALLBACK_URL=https://hm85s7nf-3000.eun1.devtunnels.ms/callback
const response = await fetch('https://hm85s7nf-3000.eun1.devtunnels.ms/pay',
const statusRes = await fetch(`https://hm85s7nf-3000.eun1.devtunnels.ms/status/${checkoutId}`);
const url = `https://hm85s7nf-3000.eun1.devtunnels.ms/transactions?mac=${clientMac}`;
```
- View billing summaries in the `[transaction.html] they are filled by mongodb in js file` 
<a href="/public/transcation.html" >View Transactions</a>

## License
This project is licensed under the MIT License.
<a href="LICENSE" >View License</a>
