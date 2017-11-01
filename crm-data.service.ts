import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

import { DataService } from './data.service';
import { CrmLogger } from './crm-logger.service';
import { PATHS } from '../constants/path.constants';

export interface CrmDataServiceConfig {
    path: string,//后台应用名称
    startIndex?: number,
    pageSize?: number,
    /**成功时的回调函数,dataInZ1数据格式
            [
                {
                    "Z08": "2016-12-28 23:59:59",
                }
            ]
     */
    success?: ( dataInZ1: Object | Object[] ) => any,//回调函数需自行处理查询不到数据的情况
    fail?: ( error: any ) => any,//失败时的回调函数
    prcCode: string,//后台每个接口的“代号”，如MC06GETLRGAMTCARDINFO
    dataX1?: Object,//请求的数据的X1这个部分, 格式为 {X01:...,X02:...,...}
    Z2Handler?: ( Z2: any[] ) => any,//处理Z2的回调函数，Z2为一个对象数组。没有Z1Handler，因为success就是用来处理Z1的
}
/**
 * 默认配置： 不设置分页参数
 */
let defaultConfigNoPaginator: CrmDataServiceConfig = {
    path: PATHS.CUSTOMER,
    startIndex: 0,
    pageSize: 0,
    success: ( dataInZ1 ) => { return dataInZ1; },
    fail: error => console.error,
    prcCode: '',
    dataX1: {},
};
/**
 * 默认配置： 设置分页参数
 */
let defaultConfigWithPaginator = Object.assign( {}, defaultConfigNoPaginator, { pageSize: 10 } );

/**
 * 请求的动作类型
 */
class ActionType {
    static REFRESH = 'refresh';//刷新当前数据
    static PRE_PAGE = 'prePage';//上一页
    static NEXT_PAGE = 'nextPage';//下一页
    static FIRST_PAGE = 'firstPage';//回到第一页
    static SINGLE_INFO = 'singleInfo';//获取单条数据
    static ALL_LIST = 'allList';//不分页，获取所有列表数据
}

/**
 * 网络请求时的加载状态
 */
class LoadingStatus {
    static IDLE = 'idle';//闲置
    static LOADING = 'loading';//加载中
    static SUCCESS = 'success';//加载成功
    static FAIL = 'fail';//加载失败
}

/**
 * TODO:
 * 1.数据缓存
 * 2. 两种默认config，分页的、单条的（或者不分页列表的） √
 * 3. 回调函数直接处理Z1、Z2之内的数据   √
 * 4. 单条数据判空，null     √
 * 5. 工厂方法，生产数据服务  √
 */
export class CrmDataService {
    private hasMoreData: boolean;//是否还有更多数据，此标志位用于分页请求当中
    private loadStatus: string;//网络请求时的加载状态
    private requset$ = new Subject<String>();//请求流
    private subscription: Subscription;//requset$的订阅对象，需要进行清理，否则会资源泄露
    private readonly DEBOUNCE_TIME = 300;//请求的延时，用于防止页面二次点击等等操作

    constructor (
        public dataService: DataService,
        public logger: CrmLogger,
        public isPaginator: boolean = false,//标志此服务类是否用于查分页列表,默认为不分页，即查单条或者不分页的列表
        public config?: CrmDataServiceConfig,
    ) {
        if ( isPaginator ) {
            this.config = Object.assign( {}, defaultConfigWithPaginator, this.config );
        }
        else {
            this.config = Object.assign( {}, defaultConfigNoPaginator, this.config );
        }
        this.hasMoreData = true;
        this.loadStatus = LoadingStatus.IDLE;

        this.subscription = this.requset$.debounceTime( this.DEBOUNCE_TIME )//延时，这是防止页面二次点击的第一道防护
            .do( actionType => this.logger.log( `发送请求 ${ actionType }` ) )
            .subscribe( actionType => this.doPost( actionType ) );
    }
    /**
     * 第一页。
     */
    firstPage (): void {
        this.requset$.next( ActionType.FIRST_PAGE );
        // this.doPost(ActionType.FIRST_PAGE);
    }
    /**
     * 获取单条数据
     */
    getSingleInfo () {
        this.requset$.next( ActionType.SINGLE_INFO );
        // this.doPost(ActionType.SINGLE_INFO);
    }
    /**
     * 不分页，获取所有列表数据
     */
    getAllList () {
        this.requset$.next( ActionType.ALL_LIST );
        // this.doPost(ActionType.ALL_LIST);
    }
    /**
     * 上一页
     */
    prePage () {
        this.requset$.next( ActionType.PRE_PAGE );
        // this.doPost(ActionType.PRE_PAGE);
    }
    /**
     * 下一页
     */
    nextPage () {
        this.requset$.next( ActionType.NEXT_PAGE );
        // this.doPost(ActionType.NEXT_PAGE);
    }
    /**
     * 原地刷新
     */
    refresh () {
        this.requset$.next( ActionType.REFRESH );
        // this.doPost(ActionType.REFRESH);
    }

    /**
     * 资源清理
     */
    clean () {
        this.subscription.unsubscribe();
    }

    /**
     * 在分页请求当中，查看是否还有更多数据
     */
    isThereMoreData (): boolean {
        return this.hasMoreData;
    }
    /**
     * 更新请求成功的回调函数
     */
    success ( success: ( dataInZ1: any ) => any ): CrmDataService {
        this.config = Object.assign( {}, this.config, { success: success } );
        return this;
    }
    /**
     * 更新请求失败的回调函数
     */
    fail ( fail: ( error: any ) => any ): CrmDataService {
        this.config = Object.assign( {}, this.config, { fail: fail } );
        return this;
    }
    /**
     * 更新配置的path参数
     */
    path ( path: string ): CrmDataService {
        this.config = Object.assign( {}, this.config, { path: path } );
        return this;
    }
    /**
     * 更新配置的prcCode参数
     */
    prcCode ( prcCode: string ): CrmDataService {
        this.config = Object.assign( {}, this.config, { prcCode: prcCode } );
        return this;
    }
    /**
     * 更新配置的dataX1参数
     */
    X1 ( x1: Object ): CrmDataService {
        this.config = Object.assign( {}, this.config, { dataX1: x1 } );
        return this;
    }
    /**
     * 便利函数，只更新配置的dataX1中的X01项
     */
    X01 ( x01: any ): CrmDataService {
        let newX1 = Object.assign( {}, this.config.dataX1, { X01: x01 } );
        this.config = Object.assign( {}, this.config, { dataX1: newX1 } );
        return this;
    }
    /**
     * 便利函数，只更新配置的dataX1中的X02项
     */
    X02 ( x02: any ): CrmDataService {
        let newX1 = Object.assign( {}, this.config.dataX1, { X02: x02 } );
        this.config = Object.assign( {}, this.config, { dataX1: newX1 } );
        return this;
    }
    /**
     * 便利函数，只更新配置的dataX1中的X03项
     */
    X03 ( x03: any ): CrmDataService {
        let newX1 = Object.assign( {}, this.config.dataX1, { X03: x03 } );
        this.config = Object.assign( {}, this.config, { dataX1: newX1 } );
        return this;
    }
    /**
     * 便利函数，只更新配置的dataX1中的X04项
     */
    X04 ( x04: any ): CrmDataService {
        let newX1 = Object.assign( {}, this.config.dataX1, { X04: x04 } );
        this.config = Object.assign( {}, this.config, { dataX1: newX1 } );
        return this;
    }

    /**
     * 更新配置的分页参数，重置startIndex、pageSize
     */
    resetPaginator (): CrmDataService {
        this.config = Object.assign( {}, this.config, { startIndex: 0 } );//pageSize固定不变
        return this;
    }

    /**
     * 设置处理Z2的回调函数
     */
    Z2Handler ( handler: ( Z2: any[] ) => any ) {
        this.config = Object.assign( {}, this.config, { Z2Handler: handler } );
        return this;
    }

    /**
     * 设置新的配置项
     */
    setConfig ( newConfig: CrmDataServiceConfig ) {
        this.config = Object.assign( {}, this.config, newConfig );
    }

    /**
     * 真正进行请求的方法
     */
    private doPost ( actionType: ActionType ) {
        if ( this.loadStatus === LoadingStatus.LOADING ) {//如果当前正在加载中，就不进行请求，这是防止页面二次点击的第二道防护
            return;
        }
        this.loadStatus = LoadingStatus.LOADING;//状态设为加载中

        let prcCode = this.config.prcCode;
        let path = this.config.path;
        let infbdyData = this.getRequestData( actionType );
        this.dataService.queryData( prcCode, infbdyData, path )
            .then( infbdyData => {
                if ( !infbdyData ) {//如果infbdyData是null
                    return [];
                }

                this.loadStatus = LoadingStatus.SUCCESS;//状态设为加载成功
                this.updateHasMoreData( infbdyData );

                if ( this.config.Z2Handler ) {//处理Z2
                    this.config.Z2Handler( infbdyData[ `${ this.config.prcCode.slice( 4 ) }Z2` ] );
                }

                return infbdyData[ `${ this.config.prcCode.slice( 4 ) }Z1` ];//将Z1中数据提取出来
            } )
            .then( dataInZ1 => {
                if ( actionType === ActionType.SINGLE_INFO ) {//若是获取单条数据，则Z1中只有一条info数据，success的参数应该是一个单条数据
                    return this.config.success( dataInZ1[ 0 ] );//无数据时返回undefined
                }
                else {//否则默认都是获取列表数据，则Z1中有多条数据，success的参数应该是列表
                    return this.config.success( dataInZ1 );//无数据时为空列表
                }
            } )
            .catch( err => {
                this.loadStatus = LoadingStatus.FAIL;//状态设为加载失败
                this.config.fail( err );
            } );
    }

    /**
     * 更新hasMoreData标志位
     */
    private updateHasMoreData ( infbdyData: any ) {
        if ( this.config.pageSize > 0 ) {
            var Z2 = infbdyData[ `${ this.config.prcCode.slice( 4 ) }Z2` ];
            if ( Z2 && Z2[ 0 ] && ( Z2[ 0 ].totalCount !== undefined ) ) {
                let totalCount = Z2[ 0 ].totalCount;
                if ( this.config.startIndex + this.config.pageSize >= totalCount ) {
                    this.hasMoreData = false;
                } else {
                    this.hasMoreData = true;
                }
            }
        }
    }

    /**
     * 获取向后台发送请求的数据体
     */
    private getRequestData ( actionType: ActionType ) {
        let prcCodeParam = this.config.prcCode.substring( 4 );//去掉前4位
        let data = {};
        data[ `${ prcCodeParam }X1` ] = [].concat( this.config.dataX1 );//this.config.data格式为{'X01':data,"X02":data,...}
        if ( this.config.pageSize > 0 ) { //有分页参数时
            this.updateStartIndex( actionType );
            let X2 = { "startIndex": this.config.startIndex, "pageSize": this.config.pageSize };//格式固定的为{ 'startIndex': startIndex, 'pageSize': pageSize }
            data[ `${ prcCodeParam }X2` ] = [].concat( X2 );
        }
        return data;
    }

    /**
     * 在请求带有分页参数的数据时，根据不同的类型来计算新的分页起点
     */
    private updateStartIndex ( type ) {
        let newStartIndex = this.config.startIndex;
        if ( this.config.pageSize > 0 ) {
            switch ( type ) {
                case ActionType.FIRST_PAGE: //回到第一页
                    newStartIndex = 0;
                    break;
                case ActionType.PRE_PAGE: //上一页
                    newStartIndex = this.config.startIndex - this.config.pageSize;
                    if ( newStartIndex < 0 ) {
                        newStartIndex = 0;
                    }
                    break;
                case ActionType.NEXT_PAGE: //下一页
                    newStartIndex = this.config.startIndex + this.config.pageSize;
                    break;
                default: // 刷新当前的数据
                    type = ActionType.REFRESH;
                    newStartIndex = this.config.startIndex;
                    break;
            }
        }
        this.config = Object.assign( {}, this.config, { startIndex: newStartIndex } );
    }
}

/**
 * 用于创建单个CrmDataService服务的工厂函数。
 *
 * isPaginator:标志此服务类是否用于查分页列表,默认为不分页，即查单条或者不分页的列表。若需要查分页列表，将此参数设为true
 *
 * config：如果暂时无法确定config的参数，可以不传或者传入null，
 * 之后在某个时刻手动调用CrmDataService.setConfig(config)来进行配置
 */
// export function crmDataServiceFactoryFunc(isPaginator: boolean = false, config?: CrmDataServiceConfig) {
//     return (dataService: DataService, logger: CrmLogger): CrmDataService => {
//         return new CrmDataService(dataService, logger, isPaginator, config);
//     }
// }

/**
 * 工厂服务类，当单个组件需要多个CrmDataService服务时，可以使用此工厂。
 */
@Injectable()
export class CrmDataServiceFactory {
    constructor (
        public dataService: DataService,
        public logger: CrmLogger
    ) { }
    /**
     * 创建查单条或者不分页的列表的服务实例
     */
    createInstanceNoPaginator ( config?: CrmDataServiceConfig ): CrmDataService {
        return new CrmDataService( this.dataService, this.logger, false, config );
    }
    /**
     * 创建查分页列表的服务实例
     */
    createInstanceWithPaginator ( config?: CrmDataServiceConfig ): CrmDataService {
        return new CrmDataService( this.dataService, this.logger, true, config );
    }
}
