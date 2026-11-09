const mongoose = require('mongoose');
const microtikSchema = new mongoose.Schema({
    macAddress: { 
        type: String,
        required: true,
        uppercase: true
     },
     phoneNumber: { 
        type: String,
        required: true
     },
     checkoutRequestID: {
        type: String,
        unique: true
     },
     planName: {
        type: String,
        required: true
     },
    status: { 
        type: String, 
        default: 'PENDING' 
    }, 
    mpesaReceiptNumber: { 
        type: String 
    },
    createdAt: { 
        type: Date,
        default: Date.now, 
    }, 
    expires: {
        type: Date,
    } 
});

const connection = async () => {
    try {   
        await mongoose.connect(process.env.MONGO_URI, {});
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

connection();

module.exports = mongoose.model('Microtik', microtikSchema);
