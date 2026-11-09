// const fs = require('fs');
// const filePath = './pending_payments.json';

// // Ensure file exists on startup
// if (!fs.existsSync(filePath)) {
//     fs.writeFileSync(filePath, JSON.stringify({}));
// }

// function savePending(checkoutRequestId, data) {
//     const fileData = fs.readFileSync(filePath, 'utf8');
//     const json = JSON.parse(fileData);
//     json[checkoutRequestId] = data;
//     fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
// }

// function getPending(checkoutRequestId) {
//     const fileData = fs.readFileSync(filePath, 'utf8');
//     const json = JSON.parse(fileData);
//     return json[checkoutRequestId];
// }

// function removePending(checkoutRequestId) {
//     const fileData = fs.readFileSync(filePath, 'utf8');
//     const json = JSON.parse(fileData);
//     delete json[checkoutRequestId];
//     fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
// }
// function getAllPending() {
//     const fileData = fs.readFileSync(filePath, 'utf8');
//     return JSON.parse(fileData);
// }
// function updateStatus(checkoutRequestId, statusData) {
//     const fileData = fs.readFileSync(filePath, 'utf8');
//     const json = JSON.parse(fileData);
//     if (json[checkoutRequestId]) {
//         json[checkoutRequestId] = { ...json[checkoutRequestId], ...statusData };
//         fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
//     }
 
// }

// module.exports = { savePending, getPending, removePending, getAllPending,updateStatus };

