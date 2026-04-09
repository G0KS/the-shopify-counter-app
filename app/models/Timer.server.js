import mongoose from "mongoose";

const timerSchema = new mongoose.Schema({
  shop: { type: String, required: true},
  title: { type: String, required: true },
  timer_type: { 
    type: String, 
    enum: ["FIXED", "EVERGREEN"], 
    default: "FIXED" 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },      
  ev_duration: { type: Number },
  description: { type: String },
  color: { type: String, default: "#000000" },
  size: { type: String, enum: ["SMALL", "MEDIUM", "LARGE"], default: "MEDIUM" },
  position: { type: String, enum: ["TOP", "BOTTOM"], default: "TOP" },
  urgency: { type: String, enum: ["NONE", "COLOR_PULSE", "SHAKE"], default: "NONE" },
}, { timestamps: true });

export const Timer = mongoose.models.Timer || mongoose.model("Timer", timerSchema);