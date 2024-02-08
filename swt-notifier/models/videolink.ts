import mongoose from 'mongoose';

const videoLinkSchema = new mongoose.Schema({
  aliases: [String],
  links: [String]
});

export default mongoose.model('VideoLink', videoLinkSchema);