import { View, div } from "gpui-kit";
import { appHome, checking, closeOverlay, exec, home, notify, panes, props, spaces } from "herdr";

const singlePaneTabs = ["1) lg", "2) nvim", "3) codex"];

async function command(name, args) {
  const { code, stdout, stderr } = await exec("/usr/bin/env", [
    `HERDR_APP_HOME=${appHome()}`,
    `${home()}/.local/bin/herdr-app`,
    "do",
    name,
    JSON.stringify(args),
  ]);
  if (code !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `${name} exited with code ${code}`);
  }
  return JSON.parse(stdout);
}

export default class FourTabSpace extends View {
  init(_props, cx) {
    if (checking()) return;

    const overlay = props().overlay;
    const machine = spaces().find((space) => space.active)?.machine ?? "";
    cx.spawn(async () => {
      try {
        const [firstTab, ...remainingTabs] = singlePaneTabs;
        const { space } = await command("space.new", { tab: firstTab, machine });
        for (const name of remainingTabs) {
          await command("tab.new", { name, space, focus: false });
        }
        const { tab } = await command("tab.new", { name: "4) dev", space, focus: false });
        const leftPane = panes().find((pane) => pane.tab === tab)?.pane;
        if (!leftPane) throw new Error("Could not find the initial pane in 4) dev");

        const { pane: upperRightPane } = await command("pane.split", { pane: leftPane, direction: "right" });
        await command("pane.split", { pane: upperRightPane, direction: "down" });
      } catch (error) {
        notify({ title: "Could not finish creating space", body: error.message, level: "error" });
      } finally {
        closeOverlay(overlay);
      }
    });
  }

  render() {
    return div().px(12).py(12).child("Opening space…");
  }
}
