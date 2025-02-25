import React, { Component, Fragment } from "react";

import ErrorMessage from "webodm/components/ErrorMessage";

import IonAssetButton from "./components/IonAssetButton";
import UploadDialog from "./components/UploadDialog";
import TasksDialog from "./components/TasksDialog";
import AppContext from "./components/AppContext";
import {
	ImplicitTaskFetcher as TaskFetcher,
	APIFetcher
} from "./components/Fetcher";
import {AssetConfig} from "./defaults";
import { fetchCancelable, getCookie } from "./utils";

export default class TaskView extends Component {
    constructor(){
        super();
        this.onOpenUploadDialog = this.onOpenUploadDialog.bind(this);
		this.showTaskDialog = this.showTaskDialog.bind(this);
    }
    
	state = {
		error: "",
		currentAsset: null,
		isTasksDialog: false,
		isUploadDialogLoading: false
	};

	cancelableFetch = null;
	timeoutHandler = null;
	refreshAssets = null;

	componentWillUnmount() {
		if (this.timeoutHandler !== null) {
			clearTimeout(this.timeoutHandler);
			this.timeoutHandler = null;
		}
		if (this.cancelableFetch !== null) {
			try {
				this.cancelableFetch.cancel();
				this.cancelableFetch = null;
			} catch (exception) {
				console.error(exception);
			}
		}

		this.refreshAssets = null;
	}

	onOpenUploadDialog(asset) {
		this.setState({ currentAsset: asset });
		if (this.uploadDialog != null) 
		{
			this.uploadDialog.show();
		}
	}

	onHideUploadDialog = () =>
		this.setState({ currentAsset: null, isUploadDialogLoading: false });

	showTaskDialog() {
		this.setState({ isTasksDialog: true });
		if (this.tasksDialog != null) 
		{
			this.tasksDialog.show();
		}	
	}

	hideTaskDialog = () => this.setState({ isTasksDialog: false });

	onUploadAsset = async data => {
		const { task, token, apiURL } = this.props;
		const { currentAsset } = this.state;
		const payload = {...data};

		if (currentAsset === null) {
			return;
		}

		payload.token = token;
		payload.asset_type = currentAsset;

		this.setState({ isUploadDialogLoading: true });
		this.cancelableFetch = await fetchCancelable(
			`/api${apiURL}/task/${task.id}/share`,
			{
				method: "POST",
				credentials: "same-origin",
				headers: {
					"X-CSRFToken": getCookie("csrftoken"),
					Accept: "application/json",
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payload)
			}
		)
			.promise.then(this.refreshAssets)
			.finally(this.onHideUploadDialog);
	};

	onClearFailedAssets = () => {
		const { task, apiURL } = this.props;

		this.cancelableFetch = fetchCancelable(
			`/api${apiURL}/task/${task.id}/clear`,
			{
				method: "POST",
				credentials: "same-origin",
				headers: {
					"X-CSRFToken": getCookie("csrftoken")
				}
			}
		);

		this.cancelableFetch.promise.then(this.refreshAssets);
	};

	onAssetsRefreshed = ({ items = [] }) => {
		const { isTasksDialog } = this.state;
		const hasTasks = items.some(item => item.isTask);

		if (! hasTasks){
			this.hideTaskDialog();
		}

		if (items.some(item => item.isTask && !item.isError)) {
			const timeout = 4000 / (isTasksDialog ? 2 : 1);
			this.timeoutHandler = setTimeout(this.refreshAssets, timeout);
		}
	};

	onCleanStatus = ({ updated = false }) => {
		if (! updated || this.refreshAssets == null){
			return;
		}

		this.refreshAssets();
	};

	onErrorUploadDialog = msg => {
		this.setState({ error: msg });
		this.onHideUploadDialog();
	};

	handleAssetSelect = data => asset => {
		const idMap = data.items
			.filter(item => item.isExported)
			.reduce((accum, item) => {
				accum[item.type] = item.id;
				return accum;
			}, {});

		if (idMap[asset] === undefined) {
			console.warn('Asset not found.', asset);
		}

		window.open(`https://cesium.com/ion/assets/${idMap[asset] ?? ''}`);
	};

	render() {
		const { task, token } = this.props;
		const {
			isTasksDialog,
			isUploadDialogLoading,
			currentAsset
		} = this.state;
		const isUploadDialog = currentAsset !== null;
		const assetName = isUploadDialog ? AssetConfig[currentAsset].name : "";

		return (
			<AppContext.Provider value={this.props}>
				<ErrorMessage bind={[this, "error"]} />
				<div className={"ion-dropdowns"}>
					<TaskFetcher
						path={"share"}
						onLoad={this.onAssetsRefreshed}
						onBindRefresh={method => (this.refreshAssets = method)}
					>
						{({ isError, data = {} }) => {
							// Asset Export and View Selector
							const { items = [] } = data;
							const available = items
								.filter(
									item => {
										return (! item.isExported && ! item.isTask) || item.isError
									}
								)
								.map(item => item.type);

							const exported = items
								.filter(item => item.isExported)
								.map(item => item.type);

							// Tasks Selector
							const processing = items.filter(item => item.isTask);
							const hasProcessingTasks = processing.length > 0;
							const hasErrors = processing.some(item => item.isError);

							return (
								<Fragment>
									{available.length > 0 && (
										<IonAssetButton
											assets={available}
											onSelect={this.onOpenUploadDialog}
										>
											Tile in Cesium Ion
										</IonAssetButton>
									)}

									{exported.length > 0 && (
										<IonAssetButton
											assets={exported}
											onSelect={this.handleAssetSelect(
												data
											)}
										>
											View in Cesium Ion
										</IonAssetButton>
									)}
									{items.length <= 0 && (
										<button
											className={"ion-btn btn btn-primary btn-sm"}
											onClick={this.refreshAssets}
										>
											<i className={"fa fa-cesium"} />
											Refresh Available ion Assets
										</button>
									)}
									{hasProcessingTasks && (
										<button
											className={`ion-btn btn btn-sm ${hasErrors ? "btn-danger" : "btn-primary"}`}
											onClick={this.showTaskDialog}
										>
											<i className={"fa fa-cesium"} />
											View ion Tasks
										</button>
									)}
									<TasksDialog
										title={"Cesium ion Tasks"}
										show={isTasksDialog}
										tasks={processing}
										onHide={this.hideTaskDialog}
										onClearFailed={this.onClearFailedAssets}
										ref={(domNode) => { this.tasksDialog = domNode; }}
									/>
								</Fragment>
							);
						}}
					</TaskFetcher>
				</div>

				<APIFetcher path={"projects/"} params={{ id: task.project }}>
					{({ isLoading, isError, data }) => {
						const initialValues = {};

						if (isLoading || assetName === "") {
							return null;
						}

						if (!isLoading && !isError && data?.length > 0) {
							const project = data[0];
							initialValues.name = `${project.name} | ${task.name} ⁠— ${assetName}`;
							initialValues.description = project.description;
						}

						return (
							<UploadDialog
								title={`Tile in Cesium ion — ${assetName}`}
								initialValues={initialValues}
								show={isUploadDialog}
								loading={isUploadDialogLoading}
								asset={currentAsset}
								onHide={this.onHideUploadDialog}
								onSubmit={this.onUploadAsset}
								onError={this.onErrorUploadDialog}
                                ref={(domNode) => { this.uploadDialog = domNode; }}
							/>
						);
					}}
				</APIFetcher>
				<TaskFetcher
					method={"POST"}
					path={"refresh"}
					body={JSON.stringify({ token })}
					onLoad={this.onCleanStatus}
				/>
			</AppContext.Provider>
		);
	}
}
