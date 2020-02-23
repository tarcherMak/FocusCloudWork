import Vue from 'vue'
import Router from 'vue-router'
import Login from '@/views/Login'
import NotFound from '@/views/404'
import Home from '@/views/Home'
import Intro from '@/views/Intro/Intro'
import Generator from '@/views/Generator/Generator'
import AddDialog from '@/views/Dialog/AddDialog'
import api from '@/http/api'
import store from '@/store'
import { getIFramePath, getIFrameUrl } from '@/utils/iframe'


/**
 * 重写路由的push方法
 */
const routerPush = Router.prototype.push
Router.prototype.push = function push(location) {
  return routerPush.call(this, location).catch(error=> error)
}


Vue.use(Router)

const router = new Router({
  routes: [
    {
      path: '/',
      name: '首页',
      component: Home,
      children: [
        { 
          path: '', 
          name: '系统介绍', 
          component: Intro,
          meta: {
            icon: 'fa fa-home fa-lg',
            index: 0
          }
        }
      ]
    },
    {
      path: '/login',
      name: '登录',
      component: Login
    }
    ,{
      path: '/404',
      name: 'notFound',
      component: NotFound
    },
    {
      path: '/AddDialog',
      name: 'AddDialog',
      component: AddDialog
    }
  ]
})
router.beforeEach((to, from, next) =>{
  //登录界面登录成功后，会把用户信息保存在会话
  //存在时间为回话生命周期，页面关闭即失效。
  let user = sessionStorage.getItem('user');
  if(to.path == '/login'){
    //如果是访问登录界面，如果用户回话信息存在，代表已登录过，跳转到主页
    if(user){
      next({ path:'/'})
    }else{
      next()
    }

  }else{
    //如果访问非登录界面，且会话信息不存在，代表未登录，则跳转到登录界面
    if(!user){
      next({ path:'/login'})
    }else{
      // 加载动态菜单和路由
      addDynamicMenuAndRoutes(user, to, from)
      next()
    }
  }
})

/**
* 加载动态菜单和路由
*/
function addDynamicMenuAndRoutes(user, to, from) {
  // 处理IFrame嵌套页面
  handleIFrameUrl(to.path)
  if(store.state.app.menRouteLoaded){
    console.log('')
    return
  }
  api.menu.findClickRoute({'moduleCode':''})
  .then( (res) => {
    // 添加动态路由
    let dynamicRoutes = addDynamicRoutes(res.data)
    // 处理静态组件绑定路由
    handleStaticComponent(router, dynamicRoutes)
    router.addRoutes(router.options.routes)
    // 保存加载状态
     store.commit('menuRouteLoaded', true)
    // 保存菜单树
    //  store.commit('setNavTree', res.data)
  })
  .catch(function(res) {
    alert(res);
  });
}

/**
 * 处理路由到本地直接指定页面组件的情况
 * 比如'环境部署'是要求直接绑定到'Generator'页面组件
 */
function handleStaticComponent(router, dynamicRoutes) {
  for(let j=0;j<dynamicRoutes.length; j++) {
    if(dynamicRoutes[j].name == '环境部署') {
      dynamicRoutes[j].component = Generator
      break
    }
  }
  router.options.routes[0].children = router.options.routes[0].children.concat(dynamicRoutes)
}

/**
 * 处理IFrame嵌套页面
 */
function handleIFrameUrl(path) {
  // 嵌套页面，保存iframeUrl到store，供IFrame组件读取展示
  let url = path
  let length = store.state.iframe.iframeUrls.length
  for(let i=0; i<length; i++) {
    let iframe = store.state.iframe.iframeUrls[i]
    if(path != null && path.endsWith(iframe.path)) {
      url = iframe.url
      store.commit('setIFrameUrl', url)
      break
    }
  }
}

/**
* 添加动态(菜单)路由
* @param {*} menuList 菜单列表
* @param {*} routes 递归创建的动态(菜单)路由
*/
function addDynamicRoutes (menuList = [], routes = []) {
  var temp = []
  for (var i = 0; i < menuList.length; i++) {
    if (menuList[i].children && menuList[i].children.length >= 1) {
      temp = temp.concat(menuList[i].children)
    } else if (menuList[i].menuRoute && /\S/.test(menuList[i].menuRoute)) {
       menuList[i].menuRoute = menuList[i].menuRoute.replace(/^\//, '')
       // 创建路由配置
       var route = {
         path: menuList[i].menuRoute,
         component: null,
         name: menuList[i].name,
         meta: {
           icon: menuList[i].icon,
           index: menuList[i].id
         }
       }
       let path = getIFramePath(menuList[i].menuRoute)
       if (path) {
         // 如果是嵌套页面, 通过iframe展示
         route['path'] = path
         route['component'] = resolve => require([`@/views/IFrame/IFrame`], resolve)
         // 存储嵌套页面路由路径和访问URL
         let url = getIFrameUrl(menuList[i].menuRoute)
         let iFrameUrl = {'path':path, 'url':url}
         store.commit('addIFrameUrl', iFrameUrl)
       } else {
        try {
          // 根据菜单URL动态加载vue组件，这里要求vue组件须按照url路径存储
          // 如url="sys/user"，则组件路径应是"@/views/sys/user.vue",否则组件加载不到
          let array = menuList[i].menuRoute.split('/')
          let url = ''
          for(let i=0; i<array.length; i++) {
             url += array[i].substring(0,1).toUpperCase() + array[i].substring(1) + '/'
          }
          url = url.substring(0, url.length - 1)
          route['component'] = resolve => require([`@/views/${url}`], resolve)
        } catch (e) {}
      }
      routes.push(route)
    }
  }
  if (temp.length >= 1) {
    addDynamicRoutes(temp, routes)
  } else {
    console.log('动态路由加载...')
    console.log(routes)
    console.log('动态路由加载完成.')
  }
  return routes
}
 
 export default router


