适用于ionic框架的通用上拉刷新、下拉加载更多组件。

# How To Use

1. 在组件ts中定义获取列表数据的数据服务配置项，如：

    ```js
	this.serivceConfig = {
      path: PATHS.MNG_S,
      prcCode: "MS01QUERYTMCRMLST",
    };
    ```
	注意： 无须使用者配置`success`与`fail`回调函数，`crm-list-frame`组件会自动帮助处理好这些细节。
		其他配置参数均需要使用者来配置，`pageSize`默认为10.

2. 在组件html中，将配置项绑定给`crm-list-frame`组件即可，然后就可以愉快的使用了，如：

	**方法①**：

    html中
    ```html
    <!--可以监听crm-list-frame组件的listChange事件，它会把最新的列表数据传出来，
        你可以获取这个列表，然后对其进行任何操作，比如渲染一个ion-list-->
    <crm-list-frame #crmListFrame [config]='serivceConfig' (listChange)='onListChange(crmListFrame.list)'>
        <ion-list>
            <ion-item *ngFor='let custManager of custManagerList' (click)='showVisiterHistory(custManager)' tappable>
                {{custManager.usrNm}}
            </ion-item>
        </ion-list>
    </crm-list-frame>
    ```

    ts中：
    ```js
    onListChange(list: any[]) {
        // 在这里对列表数据进行任何你想要的处理
        this.custManagerList = list;
    }
    ```

	**方法②**

    ```html
    <!--如果你只需要单纯的渲染列表数据，那么可以直接在ion-list上绑定到crm-list-frame组件的list属性上，如下：-->
    <crm-list-frame #crmListFrame [config]='serivceConfig'>
        <ion-list>
            <ion-item *ngFor='let custManager of crmListFrame.list' (click)='showVisiterHistory(custManager)' tappable>
                {{custManager.usrNm}}
            </ion-item>
        </ion-list>
    </crm-list-frame>
    ```
