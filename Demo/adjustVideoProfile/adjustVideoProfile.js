var client; // Agora client
var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = { 
  appid: null,
  channel: null,
  uid: null,
  token: null
};

// you can find all the agora preset video profiles here https://docs.agora.io/cn/Voice/API%20Reference/web/interfaces/agorartc.stream.html#setvideoprofile
var videoProfiles = [
  { label: "480p_1", detail: "640×480, 15fps, 500Kbps", value: "480p_1" },
  { label: "480p_2", detail: "640×480, 30fps, 1000Kbps", value: "480p_2" },
  { label: "720p_1", detail: "1280×720, 15fps, 1130Kbps", value: "720p_1" },
  { label: "720p_2", detail: "1280×720, 30fps, 2000Kbps", value: "720p_2" },
  { label: "1080p_1", detail: "1920×1080, 15fps, 2080Kbps", value: "1080p_1" },
  { label: "1080p_2", detail: "1920×1080, 30fps, 3000Kbps", value: "1080p_2" },
  { label: "640×640", detail: "640×640, 30fps", value: { width: 640, height: 640, frameRate: 30 } } // custom video profile
]

var curVideoProfile;

// the demo can auto join channel with params in url
$(() => {
  initVideoProfiles();
  $(".profile-list").delegate("a", "click", function(e){
    changeVideoProfile(this.getAttribute("label"));
  });

  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");

  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    await join();
  } catch (error) {
    console.error(error);
  } finally {
    $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
    $("#success-alert").css("display", "block");
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

async function join () {
  // create Agora client
  client = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);

  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, "all");
  console.log("subscribe success");
  const player = $(`
    <div id="player-wrapper-${uid}">
      <p class="player-name">remoteUser(${uid})</p>
      <div id="player-${uid}" class="player"></div>
    </div>
  `);
  $("#remote-playerlist").append(player);
  user.videoTrack.play(`player-${uid}`);
  user.audioTrack.play();
}

function initVideoProfiles () {
  videoProfiles.forEach(profile => {
    $(".profile-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`)
  });
  curVideoProfile = videoProfiles[0];
  $(".profile-input").val(`${curVideoProfile.detail}`);
}

async function changeVideoProfile (label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curVideoProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.videoTrack && await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value);
}

function handleUserPublished(user) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}