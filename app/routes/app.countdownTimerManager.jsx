import { Form, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
// import { Timer } from "../models/Timer.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await connectDB();
  const formData = await request.formData();

  console.log("📥 Incoming Timer Data:", Object.fromEntries(formData));

  const timerData = {
    shop: session.shop,
    name: formData.get("timerName"),
    startDate: `${formData.get("startDate")}T${formData.get("startTime")}`,
    endDate: `${formData.get("endDate")}T${formData.get("endTime")}`,
    description: formData.get("description"),
    color: formData.get("color"),
    size: formData.get("size"),
    position: formData.get("position"),
    urgency: formData.get("urgency").toUpperCase(),
  };


  console.log(timerData);
  
  // Save to MongoDB
  // await Timer.create(timerData);

  return { success: true };
};

export default function CountdownTimerManager() {
  const submit = useSubmit();
  const handleSave = () => {
    const form = document.getElementById("create-timer-form");
    if (form) submit(form); 
  };

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" commandFor="modal">
        + Create Timer
      </s-button>
      <s-section>
        <s-search-field
          label="Search timers"
          name="timerSearch"
          onInput={(e) => console.log("Search for:", e.target.value)}
        ></s-search-field>
        <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
          <s-grid-item gridColumn="span 3">
            <s-select label="Sort timers by" value="newest">
              <s-option value="newest">Newest first</s-option>
              <s-option value="oldest">Oldest first</s-option>
            </s-select>
          </s-grid-item>
        </s-grid>
        <s-divider color="strong"></s-divider>
      </s-section>

      {/* Modal for the timer */}
      <s-modal id="modal" heading="Create New Timer" variant="large">
        <Form method="POST" id="create-timer-form">
          <s-box padding="base">
            <s-stack gap="base">
              {/* Timer Name */}
              <s-text-field
                label="Timer name"
                name="title"
                placeholder="Enter timer name"
                required
              ></s-text-field>

              {/* Start Date & Time Row */}
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

              {/* End Date & Time Row */}
              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-date-field
                  label="End Date"
                  name="endDate"
                ></s-date-field>
                <s-text-field
                  label="End time"
                  name="endTime"
                  type="time"
                  icon="clock"
                ></s-text-field>
              </s-grid>

              {/* Description */}
              <s-text-area
                label="Promotion description"
                name="description"
                placeholder="Enter a detailed description"
                autocomplete="off"
              ></s-text-area>

              <s-box padding="large" border="base" borderRadius="base">
                <s-color-picker
                  value="#0f0f"
                  name="color"
                ></s-color-picker>
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
                value="Color pulse"
              >
                <s-option value="None">None</s-option>
                <s-option value="Color pulse">Color pulse</s-option>
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
