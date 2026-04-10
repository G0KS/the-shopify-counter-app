import { Form, useActionData, useLoaderData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import { Timer } from "../models/Timer.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useRef } from "react";
import { useState } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await connectDB();

  const timers = await Timer.find({ shop: session.shop })
    .sort({ createdAt: -1 })
    .lean();

  return { timers };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  await connectDB();
  const formData = await request.formData();

  // 1. Precise Date Parsing
  const startRaw = formData.get("startDate");
  const startTime = formData.get("startTime") || "00:00";
  const endRaw = formData.get("endDate");
  const endTime = formData.get("endTime") || "00:00";

  const startDate = startRaw
    ? new Date(`${startRaw}T${startTime}:00`)
    : new Date();
  const endDate = endRaw
    ? new Date(`${endRaw}T${endTime}:00`)
    : new Date(Date.now() + 86400000);

  // Stop if dates are invalid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Invalid date format." };
  }

  const timerData = {
    shop: session.shop,
    title: formData.get("title") || "Untitled Timer",
    timer_type: formData.get("timer_type"),
    startDate,
    endDate,
    ev_duration: parseInt(formData.get("ev_duration") || "0"),
    description: formData.get("description") || "",
    color: formData.get("color") || "#000000",
    size: (formData.get("size") || "MEDIUM").toUpperCase(),
    position: (formData.get("position") || "TOP").toUpperCase(),
    urgency: (formData.get("urgency") || "NONE").toUpperCase(),
    targeting: {
      applyTo: formData.get("applyTo") || "ALL",
      targetIds: JSON.parse(formData.get("targetIds") || "[]"),
    },
  };

  console.log("here", formData.get("targetIds"));

  // Save to MongoDB
  try {
    await Timer.create(timerData);
  } catch (error) {
    console.error("MongoDB Error:", error);
  }

  const shopQuery = await admin.graphql(`#graphql
    query getShopId {
      shop {
        id
      }
    }
  `);

  const shopRes = await shopQuery.json();
  const shopId = shopRes.data.shop.id;

  const mutation = `#graphql
    mutation SetTimerMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafieldsSetInput) {
        metafields {
          id
          key
        }
        userErrors {
          message
        }
      }
    }
  `;

  const metafieldResponse = await admin.graphql(mutation, {
    variables: {
      metafieldsSetInput: [
        {
          namespace: "countdown_timer",
          key: "active",
          type: "json",
          value: JSON.stringify(timerData),
          ownerId: shopId,
        },
      ],
    },
  });

  const result = await metafieldResponse.json();
  console.log("✅ Final Sync Result:", JSON.stringify(result, null, 2));

  return { success: true };
};

export default function CountdownTimerManager() {
  const formRef = useRef(null);
  const shopify = useAppBridge();
  const actionData = useActionData();
  const { timers } = useLoaderData();

  const [selectedIds, setSelectedIds] = useState([]);
  const [applyType, setApplyType] = useState("PRODUCT");
  const [timerType, setTimerType] = useState("FIXED");

  const selectProducts = async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
    });

    if (selection) {
      const ids = selection.map((p) => p.id);
      setSelectedIds(ids);
      shopify.toast.show(`${ids.length} products selected`);
    }
  };

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
      formRef.current?.reset();
      setSelectedIds([]);
      setTimerType("FIXED");
    }
  }, [actionData, shopify]);

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
              <s-heading type="strong">
                {timer.title || "Untitled Timer"}
              </s-heading>
              <s-text variant="bodyMd" tone="subdued">
                {timer.startDate
                  ? new Date(timer.startDate).toLocaleString()
                  : "No start date"}{" "}
                -
                {timer.endDate
                  ? new Date(timer.endDate).toLocaleString()
                  : "No end date"}
              </s-text>
              <s-text variant="bodyMd">
                {timer.description || "No description provided."}
              </s-text>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      {/* Modal for the timer */}
      <s-modal id="modal" heading="Create New Timer" variant="large">
        <Form method="POST" id="create-timer-form" ref={formRef}>
          <s-stack gap="base">
            <s-text-field
              label="Timer name"
              name="title"
              placeholder="Enter timer name"
              required
            ></s-text-field>

            {/* Requirement 4.1: Timer Type Selection */}
            <s-select
              label="Timer Type"
              name="timer_type"
              value={timerType}
              onInput={(e) => setTimerType(e.target.value)}
            >
              <s-option value="FIXED">Fixed (Global Schedule)</s-option>
              <s-option value="EVERGREEN">
                Evergreen (Per-visitor session)
              </s-option>
            </s-select>

            {/* Conditionally show Dates for FIXED or Duration for EVERGREEN */}
            {timerType === "FIXED" ? (
              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-date-field label="End Date" name="endDate"></s-date-field>
                <s-text-field
                  label="End time"
                  name="endTime"
                  type="time"
                  icon="clock"
                ></s-text-field>
              </s-grid>
            ) : (
              <s-text-field
                label="Evergreen Duration (Minutes)"
                name="ev_duration"
                type="number"
                placeholder="e.g., 1440 for 24 hours"
                helpText="Timer starts when a user first visits and resets after this many minutes."
              ></s-text-field>
            )}

            <s-text-area
              label="Promotion description"
              name="description"
              placeholder="Enter a detailed description"
              autocomplete="off"
            ></s-text-area>

            <s-box padding="base" border="base" borderRadius="base">
              <s-stack gap="tight">
                <s-text variant="headingSm">Targeting</s-text>
                <s-select
                  label="Apply to"
                  name="applyTo"
                  value="PRODUCT"
                  onInput={(e) => setApplyType(e.target.value)}
                >
                  <s-option value="ALL">All Products</s-option>
                  <s-option value="PRODUCT">Specific Products</s-option>
                  <s-option value="COLLECTION">Specific Collections</s-option>
                </s-select>

                {applyType === "ALL" ? (
                  ""
                ) : (
                  <s-button onClick={selectProducts} variant="secondary">
                    {selectedIds.length > 0
                      ? `Change Selected (${selectedIds.length})`
                      : "Select Products"}
                  </s-button>
                )}

                {/* Hidden input to pass the array to the action */}
                <input
                  type="hidden"
                  name="targetIds"
                  value={JSON.stringify(selectedIds)}
                />
              </s-stack>
            </s-box>

            <s-box padding="large" border="base" borderRadius="base">
              <s-text variant="headingSm">Appearance</s-text>
              <s-color-picker value="#0f0f" name="color"></s-color-picker>
            </s-box>

            {/* Size, Position, and Urgency remain as you had them */}
            <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
              <s-select label="Timer size" name="size" value="MEDIUM">
                <s-option value="SMALL">Small</s-option>
                <s-option value="MEDIUM">Medium</s-option>
                <s-option value="LARGE">Large</s-option>
              </s-select>
              <s-select label="Timer position" name="position" value="TOP">
                <s-option value="TOP">Top</s-option>
                <s-option value="BOTTOM">Bottom</s-option>
              </s-select>
            </s-grid>

            <s-select label="Urgency notification" name="urgency" value="NONE">
              <s-option value="NONE">None</s-option>
              <s-option value="COLOR_PULSE">Color pulse</s-option>
              <s-option value="SHAKE">Shake</s-option>
            </s-select>
          </s-stack>
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
