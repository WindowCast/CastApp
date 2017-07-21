window.fetch = null;
const Peer = require('skyway-peerjs-electron');
const electron = require('electron');
const desktopCapturer = electron.desktopCapturer;

class Index{
  constructor(){
    //ウィンドウ情報を取得
    this.getSources();

    //PeerJS 初期化
    this.peerInit("aba69911-791c-4e27-9129-b4fc1f2d4ec6");

    document.getElementById('btnCast').onclick = this.proxy(this.clickBtnCast,this);
    document.getElementById('btnReload').onclick = this.proxy(this.clickBtnReload,this);
    document.getElementById('btnCall').onclick = this.proxy(this.clickBtnCall,this);

    this.canvasSizeList = {'320x240':{width:320,height:240},
                          '640x480':{width:640,height:480},
                          '800x600':{width:800,height:600},
                          '1024x768':{width:1024,height:768}};
    this.canvasSize = this.canvasSizeList["800x600"];

    this.videoElement = document.getElementById('video');
    this.canvasElement = document.getElementById("canvas");

    this.canvasElement.width = this.canvasSize.width;
    this.canvasElement.height = this.canvasSize.height;
    this.videoElement.width = this.canvasSize.width;
    this.videoElement.height = this.canvasSize.height;

    this.canvasContext = this.canvasElement.getContext('2d');

    //オーディオ取得
    window.localAudioStream = null;
    this.getAudioMedia();
  }

  proxy(fn, context){
  	return function(){
  		return fn.apply(context, arguments);
  	};
  }

  clickBtnCast(ev){
      var select = document.getElementById('selectScreen');
      this.screenCast(select.value);
  }

  clickBtnReload(ev){
    this.getSources();
  }

  clickBtnCall(ev){
    var calltoId = document.getElementById("callto-id").value;
    //仮想のcanvasからStreamを取得,audioをミュートで追加 (audioを追加しないと音声が受信できない)
    window.localStream = document.createElement("canvas").captureStream();
    window.localAudioStream.addTrack( window.localStream.getVideoTracks()[0] );
    window.localAudioStream.getAudioTracks()[0].enabled = false;
    var call = this.peer.call(calltoId, window.localAudioStream);

    //var call = this.peer.call(calltoId, window.localStream);
    console.log({"call":call});
    this.peerStep3(call);
  }

  getAudioMedia(){
    var self = this;
    navigator.webkitGetUserMedia({audio:true,video:false},
      self.proxy(self.handleAudioStream,self),
      self.proxy(self.handleAudioError,self));
  }

  handleAudioStream(stream){
    console.log("handleAudioStream");
    console.log(stream);
    window.localAudioStream = stream;
  }

  handleAudioError(e){
    console.log("handleAudioError");
    console.log(e);
  }

  getSources(){
    var select = document.getElementById('selectScreen');
    select.textContent = "";

    var option = document.createElement('option');
    option.textContent = "配信する場合は画面を選択してください";
    option.value = -1;
    select.appendChild(option);

    var self = this;
    desktopCapturer.getSources({types: ['window', 'screen']}, (error, sources) => {
      if (error) throw error
      self.sources = sources;
      for (let i = 0; i < sources.length; ++i) {
        console.log("name "+sources[i].name);
        var option = document.createElement('option');
        option.textContent = sources[i].name;
        option.value = sources[i].id;
        select.appendChild(option);
      }
    });
  }

  screenCast(sourceId){
    console.log("screenCast "+sourceId);
    if(sourceId == -1){
      return;
    }

    var self = this;
    navigator.webkitGetUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: this.canvasSize.width,
          maxWidth: this.canvasSize.width,
          minHeight: this.canvasSize.height,
          maxHeight: this.canvasSize.height
        }
      }
    },
    self.proxy(self.handleStream,self),
    self.proxy(self.handleError,self));
  }

  handleStream (stream) {
    console.log("handleStream");
    console.log(stream);

    this.videoElement.srcObject = stream;
    //attachMediaStream( this.videoElement, stream );
    console.log(stream.getVideoTracks());
    console.log(stream.getAudioTracks());

    this.peerStep1(stream);
  }

  handleError (e) {
    console.log("handleError");
    console.log(e);
  }

  //PeerJS 初期化
  peerInit(key){
    var self = this;
    // PeerJS object
    var id = (new Date()).getTime();
    this.peer = new Peer(id,{turn:true,debug:3,key:key,origin:'https://windowcast-b44dd.firebaseapp.com'});
    this.peer.on('open', self.proxy(this.peerOpen,this));
    this.peer.on('call', self.proxy(this.peerCall,this));
    this.peer.on('error', self.proxy(this.peerError,this));
  }

  peerOpen(){
    console.log(this.peer);
    document.getElementById('my-id').innerHTML = this.peer.id;
  }

  // Receiving a call
  peerCall(call){
    console.log("peerCall "+call);

    if(window.localAudioStream != null){

      //オーディオストリームに 映像トラックを追加して answer処理する
      window.localAudioStream.addTrack( window.localStream.getVideoTracks()[0] );
      console.log(window.localAudioStream.getVideoTracks());
      console.log(window.localAudioStream.getAudioTracks());

      call.answer(window.localAudioStream);
    }
    else{
      call.answer(window.localStream);
    }

    this.peerStep3(call);
  }

  peerError(err){
    //alert(err.message);
    // Return to step 2 if error occurs
    //step2();
  }

  peerStep1(stream) {
    window.localStream = stream;

    //描画の更新が開始されたらCanvasに描画
    var fnc = this.proxy(this.requestAnimationFrame,this);
    window.requestAnimationFrame(fnc);
  }

  peerStep3(call) {
    var self = this;
    var calltoId = document.getElementById("callto-id").value;
    if(calltoId == ""){
      return;
    }

    // Hang up on an existing call if present
    if (window.existingCall) {
      window.existingCall.close();
    }

    // Wait for stream on the call, then set peer video display
    call.on('stream', function(stream){

      self.videoElement.srcObject = stream;
      //attachMediaStream( self.videoElement, stream );
      console.log(stream.getVideoTracks());
      console.log(stream.getAudioTracks());

      var fnc = self.proxy(self.requestAnimationFrame,self);
      window.requestAnimationFrame(fnc);
    });
  }

  requestAnimationFrame(){
    //console.log("requestAnimationFrame");
    //キャンバスサイズ変更
    this.canvasElement.width = this.canvasSize.width;
    this.canvasElement.height = this.canvasSize.height;
    this.canvasContext.drawImage(this.videoElement,0,0);

    var fnc = this.proxy(this.requestAnimationFrame,this);
    window.requestAnimationFrame(fnc);
  }
};

window.onload = function(){
  AdapterJS.webRTCReady(function(isUsingPlugin) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    new Index();
  });
};
