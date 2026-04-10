import connectDB from "../db.server";
import { Timer } from "../models/Timer.server";

export const loader = async ({ request }) => {
  await connectDB();

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId"); // We will pass this from Liquid

  // 1. Requirement 4.2: Find timer targeting this specific product
  const timer = await Timer.findOne({
    shop,
    $or: [
      { "targeting.applyTo": "ALL" },
      { "targeting.targetIds": `gid://shopify/Product/${productId}` },
    ],
  }).sort({ createdAt: -1 });

  // 2. Requirement 4.3: Tracking Impressions
  if (timer) {
    await Timer.updateOne(
      { _id: timer._id },
      { $inc: { "analytics.impressions": 1 } },
    );
  }

  return timer || { message: "No active timer found" };
};
