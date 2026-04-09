import { Form, useActionData, useLoaderData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import { Timer } from "../models/Timer.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await connectDB();

  const timers = await Timer.find({ shop: session.shop })
    .sort({ createdAt: -1 })
    .lean();

  return { timers };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await connectDB();
  const formData = await request.formData();
  const startTime = formData.get("startTime") || "00:00:00";
  const endTime = formData.get("endTime") || "23:59:59";

  const timerData = {
    shop: session.shop,
    title: formData.get("title"),
    startDate: new Date(`${formData.get("startDate")}T${startTime}:00`),
    endDate: new Date(`${formData.get("endDate")}T${endTime}:00`),
    description: formData.get("description"),
    color: formData.get("color"),
    size: formData.get("size")?.toUpperCase(),
    position: formData.get("position")?.toUpperCase(),
    urgency: formData.get("urgency")?.toUpperCase(),
  };

  // Save to MongoDB
  try {
    await Timer.create(timerData);
  } catch (error) {
    console.error(error);
  }

  return { success: true };
};

export default function CountdownTimerManager() {
  const shopify = useAppBridge();
  const actionData = useActionData();
  const { timers } = useLoaderData();

  const submit = useSubmit();
  const handleSave = () => {
    const form = document.getElementById("create-timer-form");
    if (form) {
      submit(form, { method: "post" });
    }
  };

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show("Timer created successfully");
    }
  }, [actionData, shopify]);

  console.log(timers);

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" commandFor="modal">
        + Create Timer
      </s-button>
      <s-section gap="base" padding="base-2">
        <s-search-field
          label="Search timers"
          name="title"
          onInput={(e) => console.log("Search for:", e.target.value)}
        ></s-search-field>
        <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
          <s-grid-item gridColumn="span 3">
            <s-select
              label="Sort timers by"
              placeholder="Select sorting method"
              value="newest"
            >
              <s-option value="newest">Newest first</s-option>
              <s-option value="oldest">Oldest first</s-option>
            </s-select>
          </s-grid-item>
        </s-grid>
        <s-divider color="strong"></s-divider>
        <s-stack gap="base">
          {timers.map((timer) => (
            <s-box
              key={timer._id}
              padding="base"
              border="base"
              borderRadius="base"
            >
              <s-paragraph type="strong">
                <s-heading type="strong">{timer.title}</s-heading>
              </s-paragraph>
              <s-text variant="bodyMd" tone="subdued">
                {new Date(timer.startDate).toLocaleString()} -{" "}
                {new Date(timer.endDate).toLocaleString()}
              </s-text>
              <s-text variant="bodyMd">{timer.description}</s-text>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      {/* Modal for the timer */}
      <s-modal id="modal" heading="Create New Timer" variant="large">
        <Form method="POST" id="create-timer-form">
          <s-box padding="base">
            <s-stack gap="base">
              <s-text-field
                label="Timer name"
                name="title"
                placeholder="Enter timer name"
                required
              ></s-text-field>

              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-date-field
                  label="Start Date"
                  name="startDate"
                ></s-date-field>
                <s-text-field
                  label="Start time"
                  name="startTime"
                  type="time"
                  icon="clock"
                ></s-text-field>
              </s-grid>

              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-date-field label="End Date" name="endDate"></s-date-field>
                <s-text-field
                  label="End time"
                  name="endTime"
                  type="time"
                  icon="clock"
                ></s-text-field>
              </s-grid>

              <s-text-area
                label="Promotion description"
                name="description"
                placeholder="Enter a detailed description"
                autocomplete="off"
              ></s-text-area>

              <s-box padding="large" border="base" borderRadius="base">
                <s-color-picker value="#0f0f" name="color"></s-color-picker>
              </s-box>

              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-select label="Timer size" name="size" value="Medium">
                  <s-option value="Small">Small</s-option>
                  <s-option value="Medium">Medium</s-option>
                  <s-option value="Large">Large</s-option>
                </s-select>
                <s-select label="Timer position" name="position" value="Top">
                  <s-option value="Top">Top</s-option>
                  <s-option value="Bottom">Bottom</s-option>
                </s-select>
              </s-grid>

              <s-select
                label="Urgency notification"
                name="urgency"
                value="Color_pulse"
              >
                <s-option value="None">None</s-option>
                <s-option value="Color_pulse">Color pulse</s-option>
                <s-option value="Shake">Shake</s-option>
              </s-select>
            </s-stack>
          </s-box>
        </Form>
        <s-button slot="secondary-actions" commandFor="modal" command="--hide">
          Close
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          commandFor="modal"
          onClick={handleSave}
        >
          Save
        </s-button>
      </s-modal>
    </s-page>
  );
}
