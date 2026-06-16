// const mongoose=require("mongoose")



// async function connectToDB(){
   
//     try{
//     await mongoose.connect(process.env.MONGO_URI)

//     console.log("Connected to database");
//    }
//    catch(err){
//     console.log(err);
    
//    }
// }
// module.exports=connectToDB


const mongoose = require("mongoose");

async function connectToDB() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("Missing MongoDB connection URI in MONGO_URI or MONGODB_URI");
    }

    console.log("Using MongoDB URI scheme:", uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://");
    console.log("MONGO_URI =", uri);

    await mongoose.connect(uri);

    console.log("Connected to database");
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  }
}

module.exports = connectToDB;