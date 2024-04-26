const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  result: {
    type: Object,
  },
});

module.exports = mongoose.model('Food', FoodSchema);
