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

  const rawTimers = await Timer.find({ shop: session.shop })
    .sort({ createdAt: -1 })
    .lean();

  const timers = rawTimers.map((timer) => ({
    ...timer,
    _id: timer._id.toString(),
  }));

  return { timers };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  await connectDB();
  const formData = await request.formData();

  const intent = formData.get("intent").toUpperCase();
  const id = formData.get("id");

  if (intent === "DELETE" && id) {
    await Timer.deleteOne({ _id: id, shop: session.shop });
    return {
      success: true,
      method: "delete",
      message: "Timer deleted successfully",
    };
  }

  const startRaw =
    formData.get("startDate") || new Date().toISOString().split("T")[0];
  const startTime = formData.get("startTime") || "00:00";
  const endRaw =
    formData.get("endDate") || new Date().toISOString().split("T")[0];
  const endTime = formData.get("endTime") || "00:00";

  const startDate = new Date(`${startRaw}T${startTime}:00`);
  const endDate = new Date(`${endRaw}T${endTime}:00`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Invalid date format." };
  }

  const timerData = {
    shop: session.shop,
    title: formData.get("title") || "Untitled Timer",
    timer_type: formData.get("timer_type"),
    startDate,
    endDate,
    endTime,
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

  // Save to MongoDB
  try {
    if (intent === "UPDATE" && id) {
      await Timer.findOneAndUpdate({ _id: id, shop: session.shop }, timerData);
    } else {
      await Timer.create(timerData);
    }
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
  if (result.errors || result.data.metafieldsSet.userErrors.length > 0) {
    console.error(
      "Shopify API Error:",
      result.errors || result.data.metafieldsSet.userErrors,
    );
    return { success: false, error: "Failed to update Shopify metafield." };
  }

  return {
    success: true,
    method: intent,
    message: `Timer ${intent === "UPDATE" ? "updated" : "created"} successfully`,
  };
};

export default function CountdownTimerManager() {
  const formRef = useRef(null);
  const shopify = useAppBridge();
  const actionData = useActionData();
  const { timers } = useLoaderData();

  const [selectedIds, setSelectedIds] = useState([]);
  const [applyType, setApplyType] = useState("PRODUCT");
  const [timerType, setTimerType] = useState("FIXED");
  const [editingTimer, setEditingTimer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const getCleanId = (timer) => {
    if (!timer || !timer._id) return "";
    if (timer._id.buffer) {
      return Array.from(new Uint8Array(Object.values(timer._id.buffer)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return timer._id.$oid || timer._id.toString();
  };

  const handleEdit = (timer) => {
    setEditingTimer(timer);
    setTimerType(timer.timer_type);
    setApplyType(timer.targeting?.applyTo || "PRODUCT");
    setSelectedIds(timer.targeting.targetIds);
  };

  useEffect(() => {
    if (editingTimer) {
      setIsOpen(true);
    }
  }, [editingTimer]);

  const handleDelete = (timer) => {
    const timerId = getCleanId(timer);

    if (confirm(`Are you sure you want to delete "${timer.title}"?`)) {
      submit({ id: timerId, intent: "DELETE" }, { method: "POST" });
    }
  };

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
      const formData = new FormData(form);
      const timerId = getCleanId(editingTimer);
      formData.set("id", timerId);
      formData.set("intent", editingTimer ? "UPDATE" : "CREATE");
      submit(formData, { method: "POST" });
    }
  };

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData?.message);
      formRef.current?.reset();
      setSelectedIds([]);
      setTimerType("FIXED");
    }
  }, [actionData, shopify]);

  const filteredTimers = timers.filter((timer) =>
    timer.title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" commandFor="modal">
        + Create Timer
      </s-button>
      <s-section gap="base" padding="base-2">
        <s-search-field
          label="Search timers"
          name="title"
          value={searchQuery}
          onInput={(e) => setSearchQuery(e.target.value)}
        ></s-search-field>
        <s-stack gap="base">
          {filteredTimers.length > 0 ? (
            filteredTimers.map((timer) => {
              const stringId = timer._id.$oid || timer._id.toString();
              const menuId = `menu-${stringId}`;
              const isEvergreen = timer.timer_type === "EVERGREEN";

              return (
                <s-box
                  key={stringId}
                  padding="base"
                  border="base"
                  borderRadius="base"
                  backgroundColor="surface"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      width: "100%",
                    }}
                  >
                    <div style={{ flex: "1" }}>
                      <s-stack gap="tight">
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <s-heading type="strong">
                            {timer.title || "Untitled Timer"}
                          </s-heading>
                          <s-badge tone={isEvergreen ? "warning" : "info"}>
                            {isEvergreen ? "Evergreen" : "Fixed"}
                          </s-badge>
                        </div>

                        <s-text variant="bodySm" tone="subdued">
                          {isEvergreen
                            ? `Duration: ${timer.ev_duration} mins`
                            : `${new Date(timer.startDate).toLocaleDateString()} - ${new Date(timer.endDate).toLocaleDateString()}`}
                        </s-text>

                        <s-text variant="bodyMd">
                          {timer.description || "No description provided."}
                        </s-text>

                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center",
                            marginTop: "4px",
                          }}
                        >
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              backgroundColor: timer.color || "#000",
                            }}
                          ></div>
                          <s-text variant="bodyXs" tone="subdued">
                            Theme Color
                          </s-text>
                        </div>
                      </s-stack>
                    </div>

                    <div style={{ marginLeft: "16px" }}>
                      <s-button commandFor={menuId} variant="tertiary">
                        Actions
                      </s-button>

                      <s-menu id={menuId} accessibilityLabel="Timer actions">
                        <s-button
                          icon="edit"
                          onClick={() => handleEdit(timer)}
                          commandFor="modal"
                        >
                          Edit
                        </s-button>
                        <s-button
                          icon="delete"
                          tone="critical"
                          onClick={() => handleDelete(timer)}
                        >
                          Delete
                        </s-button>
                      </s-menu>

                      <s-stack gap="tight" marginTop="base">
                        <s-text>
                          Impressions: {timer.analytics?.impressions || 0}
                        </s-text>
                      </s-stack>
                    </div>
                  </div>
                </s-box>
              );
            })
          ) : (
            <s-box padding="base" textAlign="center">
              <s-text tone="subdued">
                No timers found matching "{searchQuery}" &quot
              </s-text>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {/* Modal for the timer */}
      <s-modal
        id="modal"
        heading={editingTimer ? "Edit Timer" : "Create New Timer"}
        variant="large"
        onShow={isOpen}
        onHide={() => setEditingTimer(null)}
      >
        <Form
          key={editingTimer ? getCleanId(editingTimer) : "new-timer"}
          method="POST"
          id="create-timer-form"
          ref={formRef}
        >
          <s-stack gap="base">
            <s-text-field
              label="Timer name"
              name="title"
              placeholder="Enter timer name"
              defaultValue={editingTimer?.title || ""}
              required
            ></s-text-field>

            <s-select
              label="Timer Type"
              name="timer_type"
              value={timerType}
              defaultValue={editingTimer?.timer_type || "FIXED"}
              onInput={(e) => setTimerType(e.target.value)}
              required
            >
              <s-option value="FIXED">Fixed (Global Schedule)</s-option>
              <s-option value="EVERGREEN">
                Evergreen (Per-visitor session)
              </s-option>
            </s-select>

            {timerType === "FIXED" ? (
              <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                <s-date-field
                  label="End Date"
                  name="endDate"
                  defaultValue={
                    editingTimer?.endDate
                      ? new Date(editingTimer.endDate)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                ></s-date-field>
                <s-text-field
                  label="End time"
                  name="endTime"
                  type="string"
                  icon="clock"
                  defaultValue={editingTimer?.endTime || "00:00"}
                ></s-text-field>
              </s-grid>
            ) : (
              <s-text-field
                label="Evergreen Duration (Minutes)"
                name="ev_duration"
                type="number"
                defaultValue={editingTimer?.ev_duration || 0}
                placeholder="e.g., 1440 for 24 hours"
                helpText="Timer starts when a user first visits and resets after this many minutes."
              ></s-text-field>
            )}

            <s-text-area
              label="Promotion description"
              name="description"
              defaultValue={editingTimer?.description || ""}
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
                  defaultValue={editingTimer?.targeting?.applyTo || "PRODUCT"}
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
                <input
                  type="hidden"
                  name="id"
                  value={getCleanId(editingTimer)}
                />
                <input
                  type="hidden"
                  name="intent"
                  value={editingTimer ? "UPDATE" : "CREATE"}
                />
              </s-stack>
            </s-box>

            <s-box padding="large" border="base" borderRadius="base">
              <s-text variant="headingSm">Appearance</s-text>
              <s-color-picker
                value="#0f0f"
                defaultValue={editingTimer?.color || "#ffffff"}
                name="color"
              ></s-color-picker>
            </s-box>

            <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
              <s-select
                label="Timer size"
                name="size"
                value={editingTimer?.size || "MEDIUM"}
              >
                <s-option value="SMALL">Small</s-option>
                <s-option value="MEDIUM">Medium</s-option>
                <s-option value="LARGE">Large</s-option>
              </s-select>
              <s-select
                label="Timer position"
                name="position"
                value={editingTimer?.position || "TOP"}
              >
                <s-option value="TOP">Top</s-option>
                <s-option value="BOTTOM">Bottom</s-option>
              </s-select>
            </s-grid>

            <s-select
              label="Urgency notification"
              name="urgency"
              value={editingTimer?.urgency || "NONE"}
            >
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
