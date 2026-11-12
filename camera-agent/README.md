# WS3 Camera Agent

This is a **local Windows service** for industrial cameras that are controlled
through Hikrobot MVS rather than exposed by Windows as a normal webcam.  It
must run on the same workstation as the camera, not in the WS3 Docker server.
It binds only to `127.0.0.1:8765`; the WS3 page asks it only for a list of MVS
cameras and a JPEG when a Buffing check is saved.

## Installation on the camera workstation

1. Install Hikrobot **MVS** and verify the camera can be seen in MVS.
2. Open PowerShell in this `camera-agent` directory and create an environment:

   ```powershell
   py -3.10 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -e .
   ```

3. Start the agent:

   ```powershell
   ws3-camera-agent
   ```

   Its health endpoint is `http://127.0.0.1:8765/health`.  A healthy response
   is `{"status":"ok"}`.  The optional settings are documented in
   [`.env.example`](.env.example); set them as Windows environment variables
   before starting the agent.

4. Rebuild and deploy the WS3 frontend.  On the Buffing page, choose a camera
   from the **MVS / Hikrobot** group.  Ordinary USB/UVC webcams continue to be
   selected from the browser group.

## Design notes

The agent enumerates USB3 Vision, GigE Vision and supported MVS GenTL transport
layers.  It does not force `BayerGR8`: it lets each camera keep a compatible
native pixel format and asks MVS to convert Bayer, monochrome, RGB or YUV data
to BGR before returning a JPEG.  This is the key difference from a browser-only
`getUserMedia` implementation.

For the validated BU-01 `MV-CS050-60UC`, the agent applies the tuned manual
values from the existing capture script (125 µs exposure and 12 dB gain) when
the camera exposes compatible nodes.  Other MVS cameras keep their own setting
when those values do not fit; set either `WS3_MVS_EXPOSURE_US` or
`WS3_MVS_GAIN_DB` to `auto` to disable that tuning.

The same pattern is used for `PixelFormat`: `BayerGR8` is preferred for BU-01,
but an unsupported camera retains its native format and is converted by MVS.
Set `WS3_MVS_PIXEL_FORMAT=auto` to leave it unchanged.

USB3 Vision and GigE Vision are scanned by default.  For a station with a
CameraLink, CoaXPress, XoF or XoC frame grabber, set
`WS3_MVS_EXTRA_TRANSPORTS=true`; this is opt-in because probing all of those
interfaces slows down ordinary USB camera discovery.

The agent opens the device only while probing or capturing, then releases the
MVS handle.  If MVS or another program has the camera open, the Buffing page
will show the returned connection error instead of silently saving a blank
image.
