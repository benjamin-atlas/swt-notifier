import mongoose from 'mongoose';

const weakpointSchema = new mongoose.Schema({
  exercise: String,
  index: Number,
  url: String,
  weakpoint: String
});

export default mongoose.model('Weakpoint', weakpointSchema);