// @ts-ignore
import { Workspace, Vault, TFile, App, Keymap, Platform, MarkdownView, editorViewField } from 'obsidian';
import type { EditorView } from '@codemirror/view';

// Getting Active Markdown File
export const getActiveNoteFile = (workspace: Workspace) => {
    return workspace.getActiveFile();
};

// Get Full Path of the image
export const getPathOfImage = (vault: Vault, image: TFile) => {
    return vault.getResourcePath(image) + '?' + image.stat.mtime;
};

export const openInternalLink = (event: MouseEvent, link: string, app: App) => {
    app.workspace.openLinkText(link, '/', Keymap.isModifier(event, 'Mod') || 1 === event.button);
};

export const clearSpecialCharacters = (str: string) => {
    return str.replace(/\s|\W|[#$%^&*()]/g, '');
};

export const pluginIsLoaded = (app: App, pluginId: string) => {
    // @ts-ignore
    return app.plugins.getPlugin(pluginId);
};

/**
 * Determines whether the given editor is currently in Live Preview (as opposed to pure Source mode
 * or Reading mode). In Live Preview Obsidian natively renders embeds, so this plugin must disable
 * its own widgets to avoid duplicates.
 *
 * Fix for Obsidian 1.13+/1.14+: the legacy implementation read `app.vault.config.livePreview`,
 * which reflects the *default editing mode* setting, not the *actual mode of the current view*.
 * That broke in two opposite ways depending on the default:
 *   - default = Live Preview  -> plugin disabled itself even in Source mode (rendered nothing)
 *   - default = Source mode   -> plugin kept rendering in Live Preview/Reading -> duplicate embeds
 * The public `MarkdownView.getState()` API reports the real per-view mode and is used instead.
 * @param app  Plugin app reference (used by the fallback path).
 * @param view The EditorView whose state should be checked. When omitted, falls back to the
 *             active MarkdownView and, finally, to the legacy internal setting.
 */
export const livePreviewActive = (app: App, view?: EditorView): boolean => {
    // 1) Per-editor check: resolve the MarkdownView that owns this CM6 instance via the
    //    officially exported `editorViewField` and ask it for its actual view state.
    if (view) {
        try {
            const mdView = view.state.field(editorViewField, false) as MarkdownView | undefined;
            const state = mdView?.getState?.();
            if (state) {
                // Reading mode ('preview') -> Obsidian renders natively, never render here.
                // Source mode: state.source === true means pure Source mode (render here);
                //              false/undefined means Live Preview (native render, disable us).
                if (state.mode === 'preview') return true;
                return state.mode === 'source' && state.source !== true;
            }
        } catch (e) {
            // editorViewField not present on this state; fall through to the next strategy.
        }
    }
    // 2) Fallback: the currently active MarkdownView (single-window approximation).
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    const activeState = activeView?.getState?.();
    if (activeState) {
        if (activeState.mode === 'preview') return true;
        return activeState.mode === 'source' && activeState.source !== true;
    }
    // 3) Legacy fallback: the old internal setting (kept for very old Obsidian versions).
    return (app.vault as any).config?.livePreview ?? false;
};

export const getObsidianResourcePathPrefix = () => {
    // Check https://discord.com/channels/686053708261228577/1103015564055691324/1103035015404728320
    //@ts-ignore
    return Platform?.resourcePathPrefix || 'app://local/';
};
