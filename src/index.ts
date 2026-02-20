/**
 * Voxel Agent Plugin — Entry Point.
 *
 * Registers the panel component and all Python-trigger operators.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import { PluginComponentType, registerComponent } from "@fiftyone/plugins";
import { registerOperator } from "@fiftyone/operators";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { ClaudeAgentPanel } from "./components/ClaudeAgentPanel";
import { ALL_OPERATORS } from "./operators";

registerComponent({
  name: "claude_agent",
  label: "Voxel Agent",
  component: ClaudeAgentPanel,
  type: PluginComponentType.Panel,
  activator: () => true,
  Icon: SmartToyIcon,
});

for (const OperatorClass of ALL_OPERATORS) {
  registerOperator(new OperatorClass());
}
