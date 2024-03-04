const mongoose = require('mongoose');

const connectDB = async ()=>{
    mongoose.connect('mongodb+srv://blogApp:Arpit%40914@cluster0.hacjduf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(()=>{
    console.log("Hurray!Connection successful")
}).catch((err)=>{
    console.log(err);
});
}
module.exports = connectDB;