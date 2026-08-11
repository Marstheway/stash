package ffmpeg

import (
	"os"

	"github.com/stashapp/stash/pkg/models"
)

// Local hardware codec extensions and overrides, isolated from the upstream
// files so that merging upstream changes only touches a few hook call sites.
//
// The extra* helpers return (result, handled); callers fall back to the
// upstream logic when handled is false. A nil field on a codec entry means
// "not handled here, use the upstream logic for this aspect".
//
// Note: variable names intentionally match the upstream naming scheme
// (VideoCodecNHEVC etc). If upstream later adds the same codec, the
// redeclaration error is trivial to resolve by dropping this file's entry.

var (
	VideoCodecNHEVC = makeVideoCodec("HEVC NVENC", "hevc_nvenc")
	VideoCodecNAV1  = makeVideoCodec("AV1 NVENC", "av1_nvenc")
	VideoCodecIHEVC = makeVideoCodec("HEVC Intel Quick Sync Video (QSV)", "hevc_qsv")
	VideoCodecIAV1  = makeVideoCodec("AV1 Intel Quick Sync Video (QSV)", "av1_qsv")
	VideoCodecAHEVC = makeVideoCodec("HEVC Advanced Media Framework (AMF)", "hevc_amf")
	VideoCodecAAV1  = makeVideoCodec("AV1 Advanced Media Framework (AMF)", "av1_amf")
	VideoCodecMHEVC = makeVideoCodec("HEVC VideoToolbox", "hevc_videotoolbox")
	VideoCodecMAV1  = makeVideoCodec("AV1 VideoToolbox", "av1_videotoolbox")
	VideoCodecVHEVC = makeVideoCodec("HEVC VAAPI", "hevc_vaapi")
	VideoCodecVAV1  = makeVideoCodec("AV1 VAAPI", "av1_vaapi")
)

type extraHWCodecConfig struct {
	deviceInit    func(args Args, fullhw bool) Args
	filterInit    func(fullhw bool) VideoFilter
	fullHWFilter  func(fullhw bool, ver Version) (VideoFilter, bool)
	scaleTemplate func(fullhw bool, ver Version) string
	scaleHack     bool // QSV/VideoToolbox need the negative-size workaround
	maxResW       int
	maxResH       int
	codecInit     func() Args
	hlsCompat     bool
	mp4Compat     bool
	webmCompat    bool
}

func hwDRIDevice() string {
	d := os.Getenv("STASH_HW_DRI_DEVICE")
	if d == "" {
		d = "/dev/dri/renderD128"
	}
	return d
}

var extraHWCodecs = map[VideoCodec]*extraHWCodecConfig{
	// NVIDIA
	VideoCodecNHEVC: {
		deviceInit: func(args Args, fullhw bool) Args {
			args = append(args, "-hwaccel_device", "0")
			if fullhw {
				args = append(args, "-threads", "1", "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload_cuda")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 5}) { // Added in FFMpeg 5
				return "", false
			}
			return "scale_cuda=format=yuv420p", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_cuda=$value"
			if fullhw && ver.Gteq(Version{major: 5}) { // Added in FFMpeg 5
				t += ":format=yuv420p"
			}
			return t
		},
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-rc", "vbr", "-cq", "15", "-preset", "p4"}
		},
		hlsCompat: true, mp4Compat: true,
	},
	VideoCodecNAV1: {
		deviceInit: func(args Args, fullhw bool) Args {
			args = append(args, "-hwaccel_device", "0")
			if fullhw {
				args = append(args, "-threads", "1", "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload_cuda")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 5}) { // Added in FFMpeg 5
				return "", false
			}
			return "scale_cuda=format=yuv420p", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_cuda=$value"
			if fullhw && ver.Gteq(Version{major: 5}) { // Added in FFMpeg 5
				t += ":format=yuv420p"
			}
			return t
		},
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-rc", "vbr", "-cq", "20", "-preset", "p4"}
		},
		mp4Compat: true, webmCompat: true,
	},

	// Intel QSV
	VideoCodecIHEVC: {
		deviceInit: func(args Args, fullhw bool) Args {
			if fullhw {
				args = append(args, "-hwaccel", "qsv", "-hwaccel_output_format", "qsv")
			} else {
				args = append(args, "-init_hw_device", "qsv=hw", "-filter_hw_device", "hw")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("hwupload=extra_hw_frames=64").Append("format=qsv")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 3, minor: 3}) { // Added in FFMpeg 3.3
				return "", false
			}
			return "scale_qsv=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_qsv=$value"
			if fullhw && ver.Gteq(Version{major: 3, minor: 3}) { // Added in FFMpeg 3.3
				t += ":format=nv12"
			}
			return t
		},
		scaleHack: true,
		maxResW:   8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-global_quality", "20", "-preset", "faster"}
		},
		hlsCompat: true, mp4Compat: true,
	},
	VideoCodecIAV1: {
		deviceInit: func(args Args, fullhw bool) Args {
			if fullhw {
				args = append(args, "-hwaccel", "qsv", "-hwaccel_output_format", "qsv")
			} else {
				args = append(args, "-init_hw_device", "qsv=hw", "-filter_hw_device", "hw")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("hwupload=extra_hw_frames=64").Append("format=qsv")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 3, minor: 3}) { // Added in FFMpeg 3.3
				return "", false
			}
			return "scale_qsv=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_qsv=$value"
			if fullhw && ver.Gteq(Version{major: 3, minor: 3}) { // Added in FFMpeg 3.3
				t += ":format=nv12"
			}
			return t
		},
		scaleHack: true,
		maxResW:   8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-global_quality", "25", "-preset", "faster"}
		},
		mp4Compat: true, webmCompat: true,
	},

	// VAAPI (AMD/Intel)
	VideoCodecVHEVC: {
		deviceInit: func(args Args, fullhw bool) Args {
			args = append(args, "-vaapi_device", hwDRIDevice())
			if fullhw {
				args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 3, minor: 1}) { // Added in FFMpeg 3.1
				return "", false
			}
			return "scale_vaapi=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_vaapi=$value"
			if fullhw && ver.Gteq(Version{major: 3, minor: 1}) { // Added in FFMpeg 3.1
				t += ":format=nv12"
			}
			return t
		},
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-qp", "20"}
		},
		hlsCompat: true, mp4Compat: true,
	},
	VideoCodecVAV1: {
		deviceInit: func(args Args, fullhw bool) Args {
			args = append(args, "-vaapi_device", hwDRIDevice())
			if fullhw {
				args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 3, minor: 1}) { // Added in FFMpeg 3.1
				return "", false
			}
			return "scale_vaapi=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			t := "scale_vaapi=$value"
			if fullhw && ver.Gteq(Version{major: 3, minor: 1}) { // Added in FFMpeg 3.1
				t += ":format=nv12"
			}
			return t
		},
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-qp", "25"}
		},
		mp4Compat: true, webmCompat: true,
	},

	// AMD AMF (software decode + hardware encode)
	VideoCodecAHEVC: {
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-quality", "speed"}
		},
		hlsCompat: true, mp4Compat: true,
	},
	VideoCodecAAV1: {
		maxResW: 8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-quality", "balanced"}
		},
		mp4Compat: true, webmCompat: true,
	},

	// Apple VideoToolbox
	VideoCodecMHEVC: {
		deviceInit: func(args Args, fullhw bool) Args {
			if fullhw {
				args = append(args, "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld")
			} else {
				args = append(args, "-init_hw_device", "videotoolbox=vt")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 4, minor: 3}) { // Added in FFMpeg 4.3
				return "", false
			}
			return "scale_vt=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			return "scale_vt=$value"
		},
		scaleHack: true,
		maxResW:   8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-realtime", "1"}
		},
		hlsCompat: true, mp4Compat: true,
	},
	VideoCodecMAV1: {
		deviceInit: func(args Args, fullhw bool) Args {
			if fullhw {
				args = append(args, "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld")
			} else {
				args = append(args, "-init_hw_device", "videotoolbox=vt")
			}
			return args
		},
		filterInit: func(fullhw bool) VideoFilter {
			var vf VideoFilter
			if !fullhw {
				vf = vf.Append("format=nv12").Append("hwupload")
			}
			return vf
		},
		fullHWFilter: func(fullhw bool, ver Version) (VideoFilter, bool) {
			if !fullhw || !ver.Gteq(Version{major: 4, minor: 3}) { // Added in FFMpeg 4.3
				return "", false
			}
			return "scale_vt=format=nv12", true
		},
		scaleTemplate: func(fullhw bool, ver Version) string {
			return "scale_vt=$value"
		},
		scaleHack: true,
		maxResW:   8192, maxResH: 8192,
		codecInit: func() Args {
			return Args{"-realtime", "1"}
		},
		mp4Compat: true, webmCompat: true,
	},

	// Local overrides for upstream codecs
	VideoCodecV264: {maxResW: 4096, maxResH: 4096},
	VideoCodecVVP9: {maxResW: 4096, maxResH: 4096},
	VideoCodecA264: {maxResW: 4096, maxResH: 4096},
	VideoCodecM264: {maxResW: 4096, maxResH: 4096},
}

// Priority list for hardware codec testing: modern codecs first, then the
// upstream codecs that this build additionally exercises (AMF/OMX/VP8).
func extraHWCodecPriority() []VideoCodec {
	return []VideoCodec{
		VideoCodecNAV1, VideoCodecNHEVC,
		VideoCodecIAV1, VideoCodecIHEVC,
		VideoCodecVAV1, VideoCodecVHEVC,
		VideoCodecAAV1, VideoCodecAHEVC,
		VideoCodecMAV1, VideoCodecMHEVC,
		VideoCodecA264, VideoCodecO264, VideoCodecVVPX,
	}
}

func extraHWDeviceInit(args Args, toCodec VideoCodec, fullhw bool) (Args, bool) {
	if c := extraHWCodecs[toCodec]; c != nil && c.deviceInit != nil {
		return c.deviceInit(args, fullhw), true
	}
	return args, false
}

func extraHWFilterInit(toCodec VideoCodec, fullhw bool) (VideoFilter, bool) {
	if c := extraHWCodecs[toCodec]; c != nil && c.filterInit != nil {
		return c.filterInit(fullhw), true
	}
	return "", false
}

func extraHWApplyFullHWFilter(args VideoFilter, codec VideoCodec, fullhw bool, ver Version) (VideoFilter, bool) {
	if c := extraHWCodecs[codec]; c != nil && c.fullHWFilter != nil {
		return c.fullHWFilter(fullhw, ver)
	}
	return args, false
}

func extraHWApplyScaleTemplate(sargs string, codec VideoCodec, match []int, vf *models.VideoFile, fullhw bool, ver Version) (VideoFilter, bool) {
	c := extraHWCodecs[codec]
	if c == nil || c.scaleTemplate == nil {
		return "", false
	}
	template := c.scaleTemplate(fullhw, ver)
	if template == "" {
		return VideoFilter(sargs), true
	}
	return VideoFilter(templateReplaceScale(sargs, template, match, vf, c.scaleHack)), true
}

func extraHWCodecMaxRes(codec VideoCodec) (int, int, bool) {
	if c := extraHWCodecs[codec]; c != nil && c.maxResW != 0 {
		return c.maxResW, c.maxResH, true
	}
	return 0, 0, false
}

func extraCodecInit(codec VideoCodec) (Args, bool) {
	if c := extraHWCodecs[codec]; c != nil && c.codecInit != nil {
		return c.codecInit(), true
	}
	return nil, false
}

func extraHLSCompatible(support []VideoCodec) *VideoCodec {
	for i := range support {
		if c := extraHWCodecs[support[i]]; c != nil && c.hlsCompat {
			return &support[i]
		}
	}
	return nil
}

func extraMP4Compatible(support []VideoCodec) *VideoCodec {
	for i := range support {
		if c := extraHWCodecs[support[i]]; c != nil && c.mp4Compat {
			return &support[i]
		}
	}
	return nil
}

func extraWEBMCompatible(support []VideoCodec) *VideoCodec {
	for i := range support {
		if c := extraHWCodecs[support[i]]; c != nil && c.webmCompat {
			return &support[i]
		}
	}
	return nil
}

// extraCopyCompatible reports whether a source file's codec can be streamed
// without transcoding into the given container, beyond the upstream cases.
func extraCopyCompatible(codecName string, container Container) bool {
	switch container {
	case Mp4:
		return codecName == Hevc || codecName == H265 || codecName == Av1
	case Webm:
		return codecName == Av1
	}
	return false
}
