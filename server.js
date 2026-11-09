const  express = require('express');
const app = express();
const pay = require('./router/pay');
const microtik = require('./router/microtik');
const microtikSchema = require('./router/microtikSchema');
const servepages = require('./router/servepages');
const mongoose = require('mongoose');
const cors = require('cors');
const PORT = process.env.PORT || 3000;
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
require('dotenv').config();
app.use(express.json());
app.use(pay);
app.use(microtik);
app.use(express.static('public'));
app.use(servepages);

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
});
