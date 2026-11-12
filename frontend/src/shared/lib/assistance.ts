import { t, type Key } from "@/shared/i18n";

/** Optional paid services offered alongside a sale. Each info sheet is a list of highlighted lines. */
export type AssistanceInfo = {
  title: string; // tick box label and sheet title
  note: string; // small line under the label
  intro: string;
  items: [string, string][]; // [highlighted name, what it means]
  footer: string;
  confirm: string; // button in the info sheet
};

type Prefix = "help.doc" | "help.dev" | "help.fin";

/** Reads the words at use time (getters), so the text follows the chosen language. */
function info(p: Prefix, count: number, note: Key, confirm: Key): AssistanceInfo {
  return {
    get title() {
      return t(`${p}.title` as Key);
    },
    get note() {
      return t(note);
    },
    get intro() {
      return t(`${p}.intro` as Key);
    },
    get items() {
      return Array.from({ length: count }, (_, i): [string, string] => [t(`${p}.${i + 1}n` as Key), t(`${p}.${i + 1}` as Key)]);
    },
    get footer() {
      return t(`${p}.footer` as Key);
    },
    get confirm() {
      return t(confirm);
    },
  };
}

export const DOC_HELP: AssistanceInfo = info("help.doc", 5, "help.charges", "help.needThis");
export const DEV_HELP: AssistanceInfo = info("help.dev", 7, "help.charges", "help.needThis");
export const FINANCE_HELP: AssistanceInfo = info("help.fin", 6, "help.fin.note", "help.fin.confirm");
