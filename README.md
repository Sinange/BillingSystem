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
MIKROTIK_HOST=
MIKROTIK_USER=
MIKROTIK_PASSWORD=
MIKROTIK_REST_PORT=
MONGO_URI=mongodb+srv://...
```

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
<a href="license" >View License</a>
