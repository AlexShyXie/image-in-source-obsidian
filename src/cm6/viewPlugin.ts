import { Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import OzanImagePlugin from 'src/main';
import { StatefulDecorationSet } from 'src/cm6/decorations';
import { statefulDecorations } from 'src/cm6/stateField';
import { livePreviewActive, pluginIsLoaded } from 'src/util/obsidianHelper';

// --> View Plugin
export const getViewPlugin = (params: { plugin: OzanImagePlugin }): Extension => {
    const { plugin } = params;

    const imageViewPlugin = ViewPlugin.fromClass(
        class {
            decoManager: StatefulDecorationSet;
            // Track the last known editing mode so that switching between Live Preview /
            // Source mode / Reading mode re-evaluates this plugin even though the document
            // itself does not change. Obsidian 1.13+ shares one CM6 instance across those
            // modes, so a mode switch arrives here as a reconfigure transaction without
            // docChanged/viewportChanged flags. Without this tracking, widgets rendered in
            // Source mode survived into Live Preview (duplicates) and vice versa the plugin
            // stayed disabled after switching back to Source mode.
            lastModeWasLivePreview: boolean | null = null;

            constructor(view: EditorView) {
                this.decoManager = new StatefulDecorationSet(view);
                const lp = livePreviewActive(plugin.app, view);
                this.lastModeWasLivePreview = lp;
                if (!lp) {
                    const state = view.state;
                    this.decoManager.updateAsyncDecorations({ view, state, newDoc: state.doc, plugin });
                }
            }

            update(update: ViewUpdate) {
                const lp = livePreviewActive(plugin.app, update.view);
                const modeChanged = lp !== this.lastModeWasLivePreview;
                this.lastModeWasLivePreview = lp;

                if (modeChanged) {
                    if (lp) {
                        // Switched to Live Preview / Reading mode: Obsidian renders embeds
                        // natively there, so remove our widgets to avoid duplicates.
                        //
                        // IMPORTANT: CM6 forbids dispatching transactions while an update is
                        // in progress ("Calls to EditorView.update are not allowed while an
                        // update is in progress"). Mode switches arrive here as a reconfigure
                        // transaction, i.e. we ARE inside an update. Defer the dispatch to the
                        // next macrotask so it runs outside the update cycle.
                        const editorView = this.decoManager.editor;
                        setTimeout(() => {
                            try {
                                editorView.dispatch({
                                    effects: statefulDecorations.update.of(Decoration.none),
                                });
                            } catch (e) {
                                // The view may already be destroyed (leaf closed during the
                                // switch); dropping the cleanup is fine in that case.
                            }
                        }, 0);
                    } else {
                        // Switched to (pure) Source mode: (re)build our widgets.
                        // updateAsyncDecorations is async; its dispatch runs after awaits,
                        // i.e. outside the current update cycle, so it is safe to start here.
                        const state = update.view.state;
                        this.decoManager.updateAsyncDecorations({ view: update.view, plugin, newDoc: state.doc });
                    }
                    return;
                }

                if ((update.docChanged || update.viewportChanged) && !lp) {
                    const state = update.view.state;
                    this.decoManager.updateAsyncDecorations({ view: update.view, plugin, newDoc: state.doc });
                }
            }

            destroy() {}
        }
    );

    return imageViewPlugin;
};
