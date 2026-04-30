# Video Call Black Screen Debugging Guide

## Issue
Both users (Android and Web) can accept the call and see the call screen, but they only see a black screen instead of each other's video.

## Common Causes

### 1. **Media Tracks Not Being Sent**
- Local media stream is obtained but tracks are not added to peer connection
- Tracks are added but are disabled or in wrong state

### 2. **WebRTC Signaling Issues**
- Offer/Answer exchange is incomplete
- Remote description is not set properly
- ICE candidates are not being exchanged

### 3. **Stream Not Attached to Video Element**
- Remote stream is received but not set to video element
- Video element autoplay is blocked by browser
- Stream has no active tracks

## Debugging Steps

### Step 1: Check Browser Console Logs

When you start/accept a call, you should see these logs in sequence:

#### **For Caller (Web → Android or Web → Web):**
```
🎬 Starting call with params: {...}
🎥 Requesting media: { video: true, audio: true }
✅ Media stream obtained, tracks: ['audio', 'video']
➕ Adding local track to peer connection: audio enabled: true
➕ Adding local track to peer connection: video enabled: true
📤 Creating offer...
✅ Offer created
✅ Local description (offer) set
✅ Call saved to Firestore: [callId]
👂 Starting Firestore listeners for call: [callId], isCaller: true
📡 Emitting call-offer with callerName: [name]
```

Then wait for answer:
```
📥 Call update from Firestore:
  - Status: ACCEPTED
  - isCaller: true
  - Has answer: true
  - Answer type: answer
📥 Caller: Received answer from receiver, setting remote description...
  - Answer SDP length: [number]
  - Current signaling state: have-local-offer
✅ Remote answer set successfully!
  - New signaling state: stable
```

Then wait for remote tracks:
```
✅ ontrack event fired!
  - Track kind: audio
  - Track enabled: true
  - Track readyState: live
  - Streams: 1
  - Stream id: [id]
  - Stream tracks: ['audio:true', 'video:true']
✅ ontrack event fired!
  - Track kind: video
  - Track enabled: true
  - Track readyState: live
```

#### **For Receiver (Android → Web or Web → Web):**
```
📞 Incoming call from Firestore (Android): {...}
✅ Accepting video call from: [userId]
📋 Incoming call offer: { type: 'offer', sdp: '...' }
🎥 Requesting media: { video: true, audio: true }
✅ Media stream obtained, tracks: ['audio', 'video']
➕ Adding local track to peer connection: audio enabled: true
➕ Adding local track to peer connection: video enabled: true
📥 Setting remote description (offer)...
✅ Remote description (offer) set successfully
  - Remote description type: offer
  - Remote description SDP length: [number]
📤 Creating answer...
✅ Answer created
  - Answer type: answer
  - Answer SDP length: [number]
✅ Local description (answer) set successfully
✅ Answer saved to Firestore for Android
✅ Answer emitted via Socket.IO
```

Then wait for remote tracks (same as caller).

### Step 2: Check ICE Connection State

You should see:
```
🧊 ICE gathering state: gathering
🧊 ICE gathering state: complete
🧊 ICE connection state: checking
🧊 ICE connection state: connected
📡 Connection state: connected
✅ Peer connection established!
```

### Step 3: Check Video Element

In CallWindow component, you should see:
```
📹 Local stream changed: Available
  - Local stream tracks: ['audio:true:live', 'video:true:live']
📺 Remote stream changed: Available
  - Remote stream id: [id]
  - Remote stream tracks: ['audio:true:live', 'video:true:live']
✅ Setting remote stream to video element
✅ Remote video playing
```

## Common Issues and Solutions

### Issue 1: "ontrack event not firing"
**Symptoms:** No remote stream received, stuck on "Connecting..."

**Possible Causes:**
- Answer not received by caller
- Tracks not added before creating offer/answer
- ICE candidates not exchanged

**Solutions:**
1. Check if answer is saved to Firestore: Look for "✅ Answer saved to Firestore"
2. Check if caller receives answer: Look for "📥 Caller: Received answer from receiver"
3. Verify tracks are added: Look for "➕ Adding local track to peer connection"
4. Check ICE state: Should reach "connected"

### Issue 2: "Remote stream has no tracks"
**Symptoms:** ontrack fires but stream.getTracks() returns empty array

**Possible Causes:**
- Tracks are added after offer/answer exchange
- Tracks are disabled or stopped

**Solutions:**
1. Ensure tracks are added BEFORE creating offer/answer
2. Check track state: `track.readyState` should be "live"
3. Check track enabled: `track.enabled` should be true

### Issue 3: "Video element shows black screen"
**Symptoms:** Remote stream received but video shows black

**Possible Causes:**
- Video track is disabled
- Video element autoplay blocked
- Stream attached but not playing

**Solutions:**
1. Check video track: `stream.getVideoTracks()[0].enabled` should be true
2. Check video element: `videoElement.srcObject` should be set
3. Try manual play: `videoElement.play()`
4. Check browser autoplay policy

### Issue 4: "ICE connection fails"
**Symptoms:** ICE state stuck at "checking" or goes to "failed"

**Possible Causes:**
- Firewall blocking UDP
- TURN server not working
- Network incompatibility

**Solutions:**
1. Check TURN server credentials
2. Try different TURN servers
3. Check firewall settings
4. Test on different network

## Testing Checklist

Run through these tests:

### Web → Web Call
- [ ] Caller sees own video in PiP
- [ ] Receiver sees own video in PiP
- [ ] Caller sees receiver's video (main)
- [ ] Receiver sees caller's video (main)
- [ ] Audio works both ways
- [ ] Video toggle works
- [ ] Mute toggle works

### Android → Web Call
- [ ] Web receives call notification
- [ ] Web accepts call → Call window appears
- [ ] Web sees "Connecting..." initially
- [ ] Web sees own video in PiP
- [ ] Web sees Android video (main)
- [ ] Android sees Web video
- [ ] Audio works both ways

### Web → Android Call
- [ ] Android receives call notification
- [ ] Android accepts call
- [ ] Web sees own video in PiP
- [ ] Web sees Android video (main)
- [ ] Android sees Web video
- [ ] Audio works both ways

## Key Console Commands for Debugging

Open browser console and run:

```javascript
// Check if peer connection exists
console.log('PC:', peerConnectionRef.current);

// Check connection state
console.log('Connection state:', peerConnectionRef.current?.connectionState);
console.log('ICE state:', peerConnectionRef.current?.iceConnectionState);
console.log('Signaling state:', peerConnectionRef.current?.signalingState);

// Check local stream
console.log('Local stream:', streamRef.current);
console.log('Local tracks:', streamRef.current?.getTracks());

// Check remote stream
console.log('Remote stream:', remoteStream);
console.log('Remote tracks:', remoteStream?.getTracks());

// Check if tracks are enabled
streamRef.current?.getTracks().forEach(t => {
  console.log(`${t.kind}: enabled=${t.enabled}, state=${t.readyState}`);
});
```

## Next Steps

1. **Run the call and collect logs** - Copy all console logs from both sides
2. **Identify where it fails** - Compare logs with expected sequence above
3. **Check specific issue** - Use the "Common Issues" section to diagnose
4. **Test fixes** - Apply solutions and retest

## Additional Notes

- Make sure both devices have camera/microphone permissions
- Test on different browsers (Chrome, Firefox, Safari)
- Test on different networks (WiFi, mobile data)
- Check if VPN or proxy is interfering
- Ensure Firestore rules allow read/write to calls collection
