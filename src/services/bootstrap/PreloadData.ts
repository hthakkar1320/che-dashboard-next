/*
 * Copyright (c) 2018-2020 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { Store } from 'redux';
import { container } from '../../inversify.config';
import { KeycloakSetup } from './KeycloakSetup';
import { AppState } from '../../store';
import * as BrandingStore from '../../store/Branding';
import * as UserStore from '../../store/User';
import * as WorkspacesStore from '../../store/Workspaces';
import * as DevfileRegistriesStore from '../../store/DevfileRegistries';
import * as InfrastructureNamespaceStore from '../../store/InfrastructureNamespace';
import * as Plugins from '../../store/Plugins';
import { Keycloak } from '../keycloak/Keycloak';
import { CheWorkspaceClient } from '../workspace-client/CheWorkspaceClient';

/**
 * This class prepares all init data.
 * @author Oleksii Orel
 */
export class PreloadData {
  private keycloakSetup: KeycloakSetup;
  private keycloak: Keycloak;
  private store: Store<AppState>;
  private cheWorkspaceClient: CheWorkspaceClient;

  constructor(store: Store<AppState>) {
    this.store = store;
    this.keycloakSetup = container.get(KeycloakSetup);
    this.keycloak = container.get(Keycloak);
    this.cheWorkspaceClient = container.get(CheWorkspaceClient);
  }

  async init(): Promise<void> {
    await this.updateBranding();
    await this.updateUser();
    await this.updateKeycloakUserInfo();

    this.updateRestApiClient();
    await this.updateJsonRpcMasterApi();

    this.updateWorkspaces();
    this.updateInfrastructureNamespaces();

    const settings = await this.updateWorkspaceSettings();
    await this.updatePlugins(settings);
    await this.updateRegistriesMetadata(settings);
    await this.updateDevfileSchema();
  }

  private async updateBranding(): Promise<void> {
    const { requestBranding } = BrandingStore.actionCreators;
    await requestBranding()(this.store.dispatch, this.store.getState);
  }

  private updateRestApiClient(): void {
    return this.cheWorkspaceClient.updateRestApiClient();
  }

  private async updateJsonRpcMasterApi(): Promise<void> {
    const state = this.store.getState();
    const { branding: { data: { websocketContext } } } = state;
    this.cheWorkspaceClient.setWebsocketContext(websocketContext);
    return this.cheWorkspaceClient.updateJsonRpcMasterApi();
  }

  private setUser(): void {
    const user = this.keycloakSetup.getUser();
    if (user) {
      this.store.dispatch(UserStore.setUser(user));
    }
  }

  private async updateUser(): Promise<void> {
    await this.keycloakSetup.start();
    this.setUser();
  }

  private async updateWorkspaces(): Promise<void> {
    const { requestWorkspaces } = WorkspacesStore.actionCreators;
    await requestWorkspaces()(this.store.dispatch, this.store.getState, undefined);
  }

  private async updatePlugins(settings: che.WorkspaceSettings): Promise<void> {
    const { requestPlugins } = Plugins.actionCreators;
    await requestPlugins(settings.cheWorkspacePluginRegistryUrl || '')(this.store.dispatch, this.store.getState);
  }

  private async updateInfrastructureNamespaces(): Promise<void> {
    const { requestNamespaces } = InfrastructureNamespaceStore.actionCreators;
    await requestNamespaces()(this.store.dispatch, this.store.getState);
  }

  private async updateWorkspaceSettings(): Promise<che.WorkspaceSettings> {
    const { requestSettings } = WorkspacesStore.actionCreators;
    await requestSettings()(this.store.dispatch, this.store.getState, undefined);

    return this.store.getState().workspaces.settings;
  }

  private async updateRegistriesMetadata(settings: che.WorkspaceSettings): Promise<void> {
    const { requestRegistriesMetadata } = DevfileRegistriesStore.actionCreators;
    await requestRegistriesMetadata(settings.cheWorkspaceDevfileRegistryUrl || '')(this.store.dispatch, this.store.getState, undefined);
  }

  private async updateDevfileSchema(): Promise<void> {
    const { requestJsonSchema } = DevfileRegistriesStore.actionCreators;
    return requestJsonSchema()(this.store.dispatch, this.store.getState, undefined);
  }

  private async updateKeycloakUserInfo(): Promise<void> {
    if (!KeycloakSetup.keycloakAuth.isPresent) {
      return;
    }
    const userInfo = await this.keycloak.fetchUserInfo();
    const user = Object.assign({}, this.keycloakSetup.getUser(), userInfo);
    if (user) {
      this.store.dispatch(UserStore.setUser(user));
    }
  }
}
