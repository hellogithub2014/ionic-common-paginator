import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Optional,
    Output,
    SimpleChanges,
    ViewChild,
} from "@angular/core";
import { Content, InfiniteScroll, Loading, LoadingController, Refresher, ToastController } from "ionic-angular";
import { CrmDataService, CrmDataServiceConfig, CrmDataServiceFactory } from "../../../core/services/crm-data.service";
import { CrmLogger } from "../../../core/services/crm-logger.service";
import { UtilsService } from "../../../core/services/utils.service";

@Component( {
    selector: "crm-list-frame",
    templateUrl: "crm-list-frame.component.html",
} )
export class CrmListFrameComponent implements OnInit, OnChanges {
    isScrollEnable: boolean; // 是否可以上拉加载
    beforeLoadMoreData: boolean; // 是否正在上拉
    // loading: Loading; // loading控制器
    // loadingFlag: boolean; // 是否正在loading的标志位

    @Input() config: CrmDataServiceConfig; // 数据服务的配置
    @Output() listChange: EventEmitter<any[]>; // 数据发生改变时发出的事件
    dataService: CrmDataService; // 数据服务
    list: any[]; // 数据列表
    isHaveData: boolean = false; // 是否有数据
    @ViewChild( Content ) content: Content;
    handler: any;

    constructor (
        public dataServiceFactory: CrmDataServiceFactory,
        public logger: CrmLogger,
        public toastCtrl: ToastController,
        public utilsService: UtilsService,
        // public loadingCtrl: LoadingController,
    ) {
        this.isScrollEnable = false;
        this.beforeLoadMoreData = false;
        this.listChange = new EventEmitter<any[]>();
        this.list = [];
        // this.loadingFlag = false;
    }

    /**
     * 初始化列表数据
     */
    ngOnInit () {
        this.dataService = this.dataServiceFactory.createInstanceWithPaginator( this.config );
        this.initList();
    }

    /**
     * 输入属性发生变化时，重新初始化列表
     */
    ngOnChanges ( changes: SimpleChanges ) {
        let configChange = changes[ "config" ];
        if ( configChange && configChange.currentValue && this.dataService ) {
            this.config = configChange.currentValue; // 最新的config
            this.dataService.setConfig( this.config );
            this.initList();
        }
    }

    /* -------------------------     初始化列表      -------------------------------- */

    /**
     * 改变‘上拉加载更多’相关的标志位
     */
    updateScrollFlag () {
        if ( !this.dataService.isThereMoreData() ) {
            this.beforeLoadMoreData = false;
            this.isScrollEnable = false;
        } else {
            this.beforeLoadMoreData = true;
            this.isScrollEnable = true;
        }
    }

    /**
     * 获取初始列表的成功回调
     */
    // initListSuccessCallback ( loading: Loading = null, list: any[] ) {
    initListSuccessCallback ( list: any[] ) {
        // if ( loading ) {
        //   loading.dismiss(); // 取消loading动画
        //   this.loadingFlag = false;
        // }

        this.list = list;
        this.isHaveData = true;
        this.listChange.emit( this.list );
        this.updateScrollFlag();
    }

    /**
     * 获取初始列表的失败回调
     */
    initListFailCallback ( err: any ) {
        // initListFailCallback ( loading: Loading = null, err: any ) {
        // if ( loading ) {
        //   loading.dismiss(); // 取消loading动画
        //   this.loadingFlag = false;
        // }

        this.list = [];
        this.isHaveData = true;
        this.listChange.emit( this.list );
        this.updateScrollFlag();

        this.logger.error( `CrmListFrameComponent，获取列表数据失败---->  ${ err },config: ${ JSON.stringify( this.config ) }` );
        this.utilsService.toastMessage( this.toastCtrl, `获取数据失败，请重试` );
    }

    /**
     * 获取初始列表
     */
    initList () {
        // 显示loading动画，loading不能重复利用，必须新创建
        // this.loading = this.loadingCtrl.create( {
        //   spinner: "bubbles",
        //   // dismissOnPageChange: true,
        //   // duration: 3000,
        // } );
        // this.loading.present();
        // this.loadingFlag = true;
        // 查询数据
        this.dataService
            // .success( this.initListSuccessCallback.bind( this, this.loading ) )
            // .fail( this.initListFailCallback.bind( this, this.loading ) ); // 更新回调
            .success( this.initListSuccessCallback.bind( this ) )
            .fail( this.initListFailCallback.bind( this ) ); // 更新回调
        this.dataService.firstPage();
    }

    /* -------------------------     获取下一页列表      -------------------------------- */

    /**
     * 获取下一页列表的成功回调
     */
    nextPageListSuccessCallback ( infiniteScroll: InfiniteScroll, list: any[] ) {
        this.list = [ ...this.list, ...list ]; // 连接2个列表
        this.listChange.emit( this.list );
        this.updateScrollFlag();

        infiniteScroll.complete();
    }

    /**
     * 获取下一页列表的失败回调
     */
    nextPageListFailCallback ( infiniteScroll: InfiniteScroll, err: any ) {
        this.listChange.emit( this.list );
        this.updateScrollFlag();
        infiniteScroll.complete();

        this.logger.error( `CrmListFrameComponent，获取列表数据失败---->${ err }, config: ${ JSON.stringify( this.config ) }` );
        this.utilsService.toastMessage( this.toastCtrl, `获取数据失败，请重试` );
    }

    /**
     * 获取下一页列表
     */
    nextPageList ( infiniteScroll: InfiniteScroll ) {
        this.dataService
            .success( this.nextPageListSuccessCallback.bind( this, infiniteScroll ) )
            .fail( this.nextPageListFailCallback.bind( this, infiniteScroll ) ); // 更新回调
        this.dataService.nextPage();
    }

    /* -------------------------     刷新列表      -------------------------------- */

    /**
     * 下拉刷新列表的成功回调
     */
    refreshListSuccessCallback ( refresher: Refresher, list: any[] ) {
        // this.initListSuccessCallback( undefined, list );
        this.initListSuccessCallback( list );
        refresher.complete();
    }

    /**
     * 下拉刷新列表的失败回调
     */
    refreshListFailCallback ( refresher: Refresher, err: any ) {
        // this.initListFailCallback( undefined, err );
        this.initListFailCallback( err );
        refresher.complete();
    }

    /**
     * 下拉刷新获取列表
     */
    refreshList ( refresher: any ) {
        this.dataService
            .success( this.refreshListSuccessCallback.bind( this, refresher ) )
            .fail( this.refreshListFailCallback.bind( this, refresher ) ); // 更新回调
        this.dataService.firstPage();
    }

}
