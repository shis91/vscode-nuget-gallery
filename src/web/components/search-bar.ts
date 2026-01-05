import { FASTElement, css, customElement, html, observable, repeat, when } from "@microsoft/fast-element";

import codicon from "@/web/styles/codicon.css";
import { Configuration } from "../registrations";
import lodash from "lodash";

const template = html<SearchBar>`
  <div class="search-bar">
    <div class="search-bar-left">
      <vscode-text-field
        class="search-text-field"
        @input=${(x, c) => x.FilterInputEvent(c.event.target!)}
      >
        <span slot="start" class="codicon codicon-search"></span>
      </vscode-text-field>
      <vscode-button appearance="icon" @click=${(x) => x.ReloadClicked()}>
        <span class="codicon codicon-refresh"></span>
      </vscode-button>
      ${when(
        (x) => x.isFromCache,
        html<SearchBar>`
          <span
            class="cache-indicator codicon codicon-history"
            title="From cache. Expires: ${(x) => x.GetFormattedCacheDate()}"
          ></span>
        `
      )}
    </div>
    <div class="search-bar-right">
      <vscode-dropdown
        :value=${(x) => x.selectedSourceUrl}
        @change=${(x, c) => x.SelectSource((c.event.target as HTMLInputElement).value)}
      >
        <vscode-option :value="${(x) => ""}">All</vscode-option>
        ${repeat(
          (x) => x.configuration.Configuration!.Sources,
          html<Source>` <vscode-option :value="${(x) => x.Url}">${(x) => x.Name}</vscode-option> `
        )}
      </vscode-dropdown>
      <vscode-checkbox
        :checked="${(x) => x.prerelase}"
        @change=${(x, c) => x.PrerelaseChangedEvent(c.event.target!)}
        >Prerelease</vscode-checkbox
      >
    </div>
  </div>
`;
const styles = css`
  .search-bar {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    margin-bottom: 10px;

    .search-bar-left {
      flex: 1;
      display: flex;
      gap: 4px;
      align-items: center;
      .search-text-field {
        flex: 1;
        max-width: 340px;
        min-width: 140px;
      }
      .cache-indicator {
        margin-left: 5px;
        cursor: help;
        color: var(--vscode-descriptionForeground);
      }
    }
    .search-bar-right {
      display: flex;
      gap: 10px;
    }
  }
`;

export type FilterEvent = {
  Query: string;
  Prerelease: boolean;
  SourceUrl: string;
};

@customElement({
  name: "search-bar",
  template,
  styles: [codicon, styles],
})
export class SearchBar extends FASTElement {
  @Configuration configuration!: Configuration;
  delayedPackagesLoader = lodash.debounce(() => this.EmitFilterChangedEvent(), 500);
  @observable prerelase: boolean = true;
  @observable filterQuery: string = "";
  @observable selectedSourceUrl: string = "";
  @observable isFromCache: boolean = false;
  @observable cacheExpires: Date | string | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    this.selectedSourceUrl = "";
    this.EmitFilterChangedEvent();
  }

  PrerelaseChangedEvent(target: EventTarget) {
    this.prerelase = (target as HTMLInputElement).checked;
    this.EmitFilterChangedEvent();
  }

  FilterInputEvent(target: EventTarget) {
    this.filterQuery = (target as HTMLInputElement).value;
    this.delayedPackagesLoader();
  }

  SelectSource(url: string) {
    this.selectedSourceUrl = url;
    this.EmitFilterChangedEvent();
  }

  ReloadClicked() {
    this.$emit("reload-invoked", { forceRefresh: true });
  }

  EmitFilterChangedEvent() {
    let filterEvent: FilterEvent = {
      Query: this.filterQuery,
      Prerelease: this.prerelase,
      SourceUrl: this.selectedSourceUrl,
    };
    this.$emit("filter-changed", filterEvent);
  }

  GetFormattedCacheDate() {
    if (!this.cacheExpires) return "";
    try {
      return new Date(this.cacheExpires).toLocaleString();
    } catch (e) {
      return this.cacheExpires.toString();
    }
  }
}
