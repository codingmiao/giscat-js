1、生成ProtoFeature_pb.js
protoc.exe --js_out=import_style=commonjs,binary:. ./definition/ProtoFeature.proto


2、打包
npm run build:watch


3、发布
修改package.json中的版本号

切换中央库
npm config set registry https://registry.npmjs.org/

npm adduser
输入https://www.npmjs.com/上注册的用户名密码邮箱

npm publish

发布完可把中央库再切回淘宝
npm config set registry http://registry.npm.taobao.org/


参考
https://blog.csdn.net/weixin_44586981/article/details/119388697
