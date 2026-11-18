import { View, div } from "gpui-kit";
import { Input, InputState, h_flex, v_flex } from "gpui-base";
import { appHome, checking, closeOverlay, exec, home, notify, panes, pickFolder, props, spaces, theme } from "herdr";

const singlePaneTabs = ["1) lg", "2) nvim", "3) codex"];
const visibleRows = 7;

async function zoxideFolders(machine) {
  const args = ["query", "--list"];
  const result = await exec("zoxide", args, { on: machine }).catch((error) => {
    if (machine) throw error;
    return exec("/opt/homebrew/bin/zoxide", args);
  });
  if (result.code !== 0) throw new Error("Could not read zoxide history");
  return [...new Set(result.stdout.split("\n").filter((path) => path.startsWith("/")))];
}

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
    this.overlay = props()?.overlay;
    this.machine = spaces().find((space) => space.active)?.machine ?? null;
    this.folders = [];
    this.selected = 0;
    this.busy = false;
    this.loading = !checking();
    this.handle = cx.focus_handle();
    this.input = InputState.new({
      placeholder: this.machine ? "Search zoxide or enter an absolute path…" : "Search zoxide folders…",
    });
    this.input.on("change", (_event, cx) => {
      this.selected = 0;
      cx.notify();
    });
    this.input.on("submit", (_event, cx) => {
      const folder = this.matches()[this.selected];
      if (folder) this.choose(cx, folder);
    });
    if (checking()) return;

    this.input.focus();
    cx.timer.after(600, () => {
      if (!this.busy) this.input.focus();
    });
    cx.spawn(async (cx) => {
      try {
        this.folders = await zoxideFolders(this.machine);
      } catch {
        this.historyUnavailable = true;
      }
      this.loading = false;
      cx.notify();
    });
  }

  matches() {
    const query = this.input.value().trim();
    const words = query.toLowerCase().split(/\s+/);
    const matches = this.folders.filter((path) => words.every((word) => path.toLowerCase().includes(word)));
    if (this.machine && query.startsWith("/") && !matches.includes(query)) matches.unshift(query);
    return matches;
  }

  choose(cx, folder) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const selectedFolder = folder ?? await pickFolder({ prompt: "Open Space" });
        if (selectedFolder) await this.openSpace(selectedFolder);
      } catch (error) {
        notify({ title: "Could not finish creating space", body: error.message, level: "error" });
      } finally {
        closeOverlay(this.overlay);
      }
    });
  }

  async openSpace(folder) {
    const [firstTab, ...remainingTabs] = singlePaneTabs;
    const { space } = await command("space.new", { folder, tab: firstTab, machine: this.machine ?? "" });
    for (const name of remainingTabs) {
      await command("tab.new", { name, space, folder, focus: false });
    }
    const { tab } = await command("tab.new", { name: "4) dev", space, folder, focus: false });
    const leftPane = panes().find((pane) => pane.tab === tab)?.pane;
    if (!leftPane) throw new Error("Could not find the initial pane in 4) dev");

    const { pane: upperRightPane } = await command("pane.split", { pane: leftPane, direction: "right" });
    await command("pane.split", { pane: upperRightPane, direction: "down" });
  }

  render() {
    const colors = theme();
    if (this.busy) return div().p(16).text_color(colors.foreground).child("Opening space…");

    const matches = this.matches();
    const start = Math.max(0, Math.min(this.selected, matches.length - visibleRows));
    const empty = this.loading ? "Loading zoxide history…" : this.historyUnavailable
      ? "Zoxide history is unavailable." : "No matching folders.";
    const homeDir = home();

    return v_flex()
      .id("four-tab-space")
      .track_focus(this.handle)
      .w_full()
      .p(14)
      .gap(8)
      .bg(colors.popover)
      .text_color(colors.foreground)
      .text_size(13)
      .on_key_down((event, cx) => {
        if (event.key === "escape") {
          closeOverlay(this.overlay);
        } else if (matches.length && (event.key === "down" || event.key === "up")) {
          const step = event.key === "down" ? 1 : -1;
          this.selected = (this.selected + step + matches.length) % matches.length;
          cx.notify();
        } else return;
        cx.stop_propagation();
      })
      .child(h_flex().w_full().gap(8).items_center()
        .child(Input.new(this.input).h(34).flex_1().px(9).rounded(7)
          .border_1().border_color(colors.accent).bg(colors.background))
        .when(!this.machine, (row) => row.child(div().id("browse").px(10).py(7).rounded(7)
          .bg(colors.raised).cursor_pointer().hover((style) => style.bg(colors.hover))
          .on_click((_event, cx) => this.choose(cx)).child("Browse…"))))
      .child(v_flex().id("folder-results").w_full().on_scroll_wheel((event, cx) => {
        if (matches.length < 2 || !event.delta.y) return;
        this.selected = Math.max(0, Math.min(matches.length - 1, this.selected - Math.sign(event.delta.y)));
        cx.notify();
      }).when(!matches.length, (list) => list.child(div().px(9).py(6).text_color(colors.muted).child(empty)))
        .children(matches.slice(start, start + visibleRows).map((path, index) => div()
          .id(`folder-${start + index}`).h(32).px(9).py(6).rounded(6).truncate().cursor_pointer()
          .when(start + index === this.selected, (row) => row.bg(colors.hover))
          .hover((style) => style.bg(colors.hover))
          .on_click((_event, cx) => this.choose(cx, path))
          .child(!this.machine && path.startsWith(`${homeDir}/`) ? `~${path.slice(homeDir.length)}` : path))));
  }
}
