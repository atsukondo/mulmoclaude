<template>
  <!-- Compact inline summary for non-openBook tool results. The
       openBook envelope routes to View.vue (full app) instead of
       this component; everything that lands here is a
       compact-result action (addEntries, getReport, …). -->
  <div class="text-sm text-gray-700" data-testid="accounting-preview">
    <span class="material-icons text-base align-middle mr-1">account_balance</span>
    <span>{{ summary }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResultComplete } from "gui-chat-protocol/vue";
import { useAccountingI18n } from "./lang";
import { summarisePreview } from "./previewSummary";

const { t } = useAccountingI18n();

// `result` is what SessionSidebar hands every previewComponent, and the only
// thing it hands them. This component declared `data` / `jsonData` instead and
// so never received a payload at all (#2716) — the props of a dynamic
// `<component :is>` are not typechecked, so nothing caught it.
const props = defineProps<{ result: ToolResultComplete }>();

const summary = computed<string>(() => summarisePreview(props.result.data, t));
</script>
