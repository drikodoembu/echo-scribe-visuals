<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep app navigation available at every viewport width: desktop sidebar and a compact scrollable navigation strip share the same destinations.
- Use the browser-safe pageHead helper for leaf-page metadata so each page has its own title and social description.

- Compute scene totals with the shared image-plan module and request sequential bounded batches; this preserves narration-relative counts without duplicating prompts.
- Normalize pasted-script save fields with script-save; generation settings must not prevent saving authored content.
- Use the AI Gateway SDK and generated model contracts for image and scene-prompt calls; preserve existing model choices.
