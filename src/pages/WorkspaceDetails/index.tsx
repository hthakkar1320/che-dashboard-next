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

import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import {
  PageSection,
  PageSectionVariants,
  Tabs,
  Tab,
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  Modal,
  ModalVariant,
  AlertVariant,
  TextContent,
  Text,
  Button,
} from '@patternfly/react-core';
import { WorkspaceStatus } from '../../services/workspaceStatus';
import Header from './Header';
import CheProgress from '../../components/Progress';
import { AppState } from '../../store';
import OverviewTab, { OverviewTab as Overview } from './OverviewTab';
import EditorTab, { EditorTab as Editor } from './DevfileTab';
import { selectIsLoading, selectWorkspaceById } from '../../store/Workspaces/selectors';

import './WorkspaceDetails.styl';

export const SECTION_THEME = PageSectionVariants.light;

export enum WorkspaceDetailsTabs {
  Overview = 0,
  Devfile = 4,
}

type Props =
  {
    onSave: (workspace: che.Workspace) => Promise<void>
  } & MappedProps;

type State = {
  activeTabKey?: WorkspaceDetailsTabs;
  clickedTabIndex?: WorkspaceDetailsTabs;
  alertVisible?: boolean;
  hasWarningMessage?: boolean;
  hasDiscardChangesMessage?: boolean;
};

export class WorkspaceDetails extends React.PureComponent<Props, State> {
  private alert: { variant?: AlertVariant.success | AlertVariant.danger; title?: string } = {};
  public showAlert: (variant: AlertVariant.success | AlertVariant.danger, title: string, timeDelay?: number) => void;
  private readonly hideAlert: () => void;
  private readonly handleTabClick: (event: any, tabIndex: any) => void;

  private readonly editorTabPageRef: React.RefObject<Editor>;
  private readonly overviewTabPageRef: React.RefObject<Overview>;

  constructor(props) {
    super(props);

    this.editorTabPageRef = React.createRef<Editor>();
    this.overviewTabPageRef = React.createRef<Overview>();

    this.state = {
      activeTabKey: 0,
      alertVisible: false,
      hasWarningMessage: false,
      hasDiscardChangesMessage: false,
    };

    // Toggle currently active tab
    this.handleTabClick = (event: any, tabIndex: any): void => {
      if ((this.state.activeTabKey === WorkspaceDetailsTabs.Devfile && this.editorTabPageRef.current?.state.hasChanges) ||
        (this.state.activeTabKey === WorkspaceDetailsTabs.Overview && this.overviewTabPageRef.current?.hasChanges) ||
        this.props.isLoading) {
        const focusedElement = (
          document.hasFocus() &&
          document.activeElement !== document.body &&
          document.activeElement !== document.documentElement &&
          document.activeElement
        ) || null;
        if (focusedElement) {
          (focusedElement as HTMLBaseElement).blur();
        }
        if (!this.props.isLoading) {
          this.setState({ hasDiscardChangesMessage: true, clickedTabIndex: tabIndex });
        }
        return;
      }
      this.setState({ hasDiscardChangesMessage: false, clickedTabIndex: tabIndex, activeTabKey: tabIndex });
    };
    let showAlertTimer;
    this.showAlert = (variant: AlertVariant.success | AlertVariant.danger, title: string, timeDelay?: number): void => {
      this.alert = { variant, title };
      this.setState({ alertVisible: true });
      if (showAlertTimer) {
        clearTimeout(showAlertTimer);
      }
      showAlertTimer = setTimeout(() => {
        this.setState({ alertVisible: false });
      }, timeDelay ? timeDelay : 2000);
    };
    this.hideAlert = (): void => this.setState({ alertVisible: false });
  }

  public componentDidUpdate(): void {
    if (this.props.workspace && (WorkspaceStatus[this.props.workspace?.status] === WorkspaceStatus.STOPPED)) {
      this.setState({ hasWarningMessage: false });
    }
  }

  private handleDiscardChanges(): void {
    if (this.state.activeTabKey === WorkspaceDetailsTabs.Devfile) {
      this.editorTabPageRef.current?.cancelChanges();
    } else if (this.state.activeTabKey === WorkspaceDetailsTabs.Overview) {
      this.overviewTabPageRef.current?.cancelChanges();
    }

    const tabIndex = this.state.clickedTabIndex;
    this.setState({ hasDiscardChangesMessage: false, activeTabKey: tabIndex });
  }

  private handleCancelChanges(): void {
    this.setState({ hasDiscardChangesMessage: false });
  }

  public render(): React.ReactElement {
    const { alertVisible } = this.state;
    const { workspace } = this.props;

    if (!workspace) {
      return <div>Workspace not found.</div>;
    }

    const workspaceName = workspace.devfile.metadata.name ? workspace.devfile.metadata.name : '';

    return (
      <React.Fragment>
        {alertVisible && (
          <AlertGroup isToast>
            <Alert
              variant={this.alert.variant}
              title={this.alert.title}
              actionClose={<AlertActionCloseButton onClose={this.hideAlert} />}
            />
          </AlertGroup>
        )}
        <Header workspaceName={workspaceName} status={workspace.status} />
        <PageSection variant={SECTION_THEME} className='workspace-details-tabs'>
          {(this.state.hasWarningMessage) && (
            <Alert variant={AlertVariant.warning} isInline
              title={(<React.Fragment>
                The workspace <em>{workspaceName}&nbsp;</em> should be restarted to apply changes.
              </React.Fragment>)}
              actionClose={(<AlertActionCloseButton
                onClose={() => this.setState({ hasWarningMessage: false })} />)
              } />
          )}
          <Tabs activeKey={this.state.activeTabKey} onSelect={this.handleTabClick}>
            <Tab eventKey={WorkspaceDetailsTabs.Overview} title={WorkspaceDetailsTabs[WorkspaceDetailsTabs.Overview]}>
              <CheProgress isLoading={this.props.isLoading} />
              <OverviewTab
                ref={this.overviewTabPageRef}
                workspace={workspace}
                onSave={workspace => this.onSave(workspace)}
              />
            </Tab>
            <Tab eventKey={WorkspaceDetailsTabs.Devfile} title={WorkspaceDetailsTabs[WorkspaceDetailsTabs.Devfile]}>
              <CheProgress isLoading={this.props.isLoading} />
              <EditorTab
                ref={this.editorTabPageRef}
                workspace={workspace}
                onSave={workspace => this.onSave(workspace)} />
            </Tab>
          </Tabs>
          <Modal variant={ModalVariant.small} isOpen={this.state.hasDiscardChangesMessage}
            title="Unsaved Changes"
            onClose={() => this.handleCancelChanges()}
            actions={[
              <Button key="confirm" variant="primary" onClick={() => this.handleDiscardChanges()}>
                Discard Changes
                   </Button>,
              <Button key="cancel" variant="secondary" onClick={() => this.handleCancelChanges()}>
                Cancel
                   </Button>,
            ]}
          >
            <TextContent>
              <Text>
                You have unsaved changes. You may go ahead and discard all changes, or close this window and save them.
              </Text>
            </TextContent>
          </Modal>
        </PageSection>
      </React.Fragment>
    );
  }

  private async onSave(workspace: che.Workspace): Promise<void> {
    if (this.props.workspace && (WorkspaceStatus[this.props.workspace.status] !== WorkspaceStatus.STOPPED)) {
      this.setState({ hasWarningMessage: true });
    }
    await this.props.onSave(workspace);
    this.editorTabPageRef.current?.cancelChanges();
  }

}

const mapStateToProps = (state: AppState) => ({
  isLoading: selectIsLoading(state),
  workspace: selectWorkspaceById(state),
});

const connector = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
);

type MappedProps = ConnectedProps<typeof connector>
export default connector(WorkspaceDetails);
