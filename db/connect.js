const mongoose = require('mongoose');

const connectDB = (url) => {
  try {
    console.log('🟡 connecting to mongodb');
    return mongoose.connect(url);
  } catch (error) {
    console.log('🔴 error connecting to mongodb');
    console.log(error);
  }
};

module.exports = connectDB;
