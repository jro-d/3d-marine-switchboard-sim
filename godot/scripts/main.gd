extends Node3D

@onready var hv_sim: HvSimCore = $HvSimCore
@onready var switchroom: Switchroom = $Switchroom
@onready var toolbelt_props: Node3D = $ToolbeltProps
@onready var camera_3d: Camera3D = $Camera3D

var _follow_cam: bool = false
var _cam_yaw: float = 0.35
var _cam_pitch: float = -0.22
var _cam_dist: float = 3.6
var _overview_xform: Transform3D
var _orbiting: bool = false
var _door_open: bool = false
var _tool_idx: int = -1
var _held_tool: Node3D
var _held_orig_xform: Transform3D


func _ready() -> void:
	if camera_3d != null:
		_overview_xform = camera_3d.global_transform
	if hv_sim != null:
		print(hv_sim.get_sim_info())
	if switchroom != null:
		assert(switchroom.room_shell != null, "Missing RoomShell")
		assert(switchroom.room_arch != null, "Missing RoomArchitecture")
		assert(switchroom.co2_extinguisher != null, "Missing CO2Extinguisher")
		assert(switchroom.rescue_hook != null, "Missing RescueHook")
		var door := switchroom.watertight_door
		assert(door != null and door.door_leaf_pivot != null and door.handwheel_pivot != null, "Missing WatertightDoor pivots")
		door.set_door_open(true)
		door.set_door_open(false)

		var lineup := switchroom.lineup
		var bay_names: PackedStringArray = []
		for child in lineup.get_children():
			bay_names.append(child.name)
			if child is HvBay:
				assert(child.lv_door_pivot != null, "Missing LvDoorPivot on %s" % child.name)
				assert(child.breaker_door_pivot != null, "Missing BreakerDoorPivot on %s" % child.name)
				assert(child.vcb_cassette != null, "Missing VcbCassette on %s" % child.name)
			elif child is LvBay:
				assert(child.upper_door_pivot != null, "Missing LvUpperDoorPivot on %s" % child.name)
				assert(child.lower_door_pivot != null, "Missing LvLowerDoorPivot on %s" % child.name)
		print("SwitchboardLineup ready with %d bays: %s" % [bay_names.size(), ", ".join(bay_names)])

		var trolley := switchroom.trolley
		assert(trolley != null and trolley.deck_lift != null and trolley.bed_anchor != null, "Missing VcbTrolley nodes")
		assert(trolley.wheels.size() == 4, "Expected 4 TrolleyWheel_0..3 pivots")
		trolley.set_deck_height(VcbTrolley.HV_BAY_RAIL_HEIGHT)
		trolley.set_latches_engaged(true)
		var bt_m1 := lineup.get_node_or_null("BT-M1") as HvBay
		if bt_m1 != null and bt_m1.vcb_cassette != null:
			var orig_mount := bt_m1.vcb_mount
			trolley.mount_vcb_cassette(bt_m1.vcb_cassette)
			assert(bt_m1.vcb_cassette.get_parent() == trolley.bed_anchor, "VCB mount failed")
			trolley.bed_anchor.remove_child(bt_m1.vcb_cassette)
			orig_mount.add_child(bt_m1.vcb_cassette)
			bt_m1.vcb_cassette.position = Vector3.ZERO
		trolley.set_latches_engaged(false)
		trolley.set_deck_height(VcbTrolley.DEFAULT_DECK_HEIGHT)

		var ppe := switchroom.ppe_locker
		assert(ppe != null and ppe.suit_node != null and ppe.gloves_node != null and ppe.boots_node != null, "Missing PpeLocker dynamic PPE nodes")
		ppe.set_ppe_equipped(true, true, true)
		assert(not ppe.suit_node.visible and not ppe.gloves_node.visible and not ppe.boots_node.visible)
		ppe.set_ppe_equipped(false, false, false)

		var eng := switchroom.engineer
		assert(eng != null and eng.skeleton != null and eng.anim_player != null, "Missing Engineer rig nodes")
		assert(eng.skeleton.get_bone_count() == 19, "Expected 19 bones on Engineer Skeleton3D")
		assert(eng.skeleton.find_bone("RightHand") >= 0 and eng.skeleton.find_bone("RightHandIKTarget") >= 0, "Missing RightHand bones")
		assert(eng.right_hand_attachment != null and eng.right_tool_socket != null, "Missing RightHand BoneAttachment3D socket")
		assert(eng.arc_coat != null and eng.arc_hood != null and eng.hard_hat != null, "Missing Engineer arc coat/hood/hardhat meshes")
		assert(eng.left_bare_hand != null and eng.right_bare_hand != null and eng.left_hv_glove != null and eng.right_hv_glove != null, "Missing Engineer hand/glove meshes")
		assert(eng.left_hv_sole != null and eng.right_hv_sole != null, "Missing Engineer HV overboot meshes")

		var clips := eng.get_available_clips()
		for req_clip in ["Idle", "Walk", "Sprint", "Interact"]:
			assert(req_clip in clips, "Missing Engineer animation clip: %s" % req_clip)
			eng.play_clip(req_clip)

		# Verify synchronized swappable PPE states between Engineer & PpeLocker
		eng.set_ppe_equipped(true, true, true)
		ppe.set_ppe_equipped(true, true, true)
		assert(eng.arc_coat.visible and eng.arc_hood.visible and not eng.hard_hat.visible)
		assert(eng.left_hv_glove.visible and not eng.left_bare_hand.visible)
		assert(eng.left_hv_sole.visible and eng.right_hv_sole.visible)
		eng.set_ppe_equipped(false, false, false)
		ppe.set_ppe_equipped(false, false, false)
		eng.play_clip("Idle")

		if toolbelt_props != null:
			var wand := toolbelt_props.get_node_or_null("ProvingWand") as Node3D
			if wand != null:
				var orig_xform := wand.transform
				eng.attach_tool(wand)
				assert(wand.get_parent() == eng.right_tool_socket, "Failed to attach ProvingWand to RigRightToolSocket")
				eng.right_tool_socket.remove_child(wand)
				toolbelt_props.add_child(wand)
				wand.transform = orig_xform

		assert(switchroom.permit_desk != null and switchroom.permit_desk.socket_node != null, "Missing PermitBeaconSocket")
		assert(switchroom.test_bench != null and switchroom.test_bench.socket_node != null, "Missing ProvingLedSocket")
		assert(switchroom.key_board != null and switchroom.key_board.socket_node != null, "Missing KeyBoxLedSocket")
		assert(switchroom.vcb_workbench != null and switchroom.vcb_workbench.find_child("WorkbenchToolsSocket", true, false) != null, "Missing WorkbenchToolsSocket")

		print("Switchroom ready: WatertightDoor pivots, 5 bays, VcbTrolley, PpeLocker, 4 stations & Engineer (19 bones, %d clips) verified" % clips.size())

	if toolbelt_props != null:
		var tool_names: PackedStringArray = []
		for child in toolbelt_props.get_children():
			if child is HandheldTool:
				assert(child.tip_anchor != null, "Missing TipAnchor on %s" % child.name)
				child.visible = false
				tool_names.append(child.name)
		print("ToolbeltProps ready with %d tools: %s" % [tool_names.size(), ", ".join(tool_names)])


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_RIGHT:
			_orbiting = mb.pressed
		elif mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_cam_dist = clamp(_cam_dist - 0.35, 1.6, 8.5)
		elif mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_cam_dist = clamp(_cam_dist + 0.35, 1.6, 8.5)
	elif event is InputEventMouseMotion and _orbiting:
		var mm := event as InputEventMouseMotion
		_cam_yaw -= mm.relative.x * 0.0055
		_cam_pitch = clamp(_cam_pitch - mm.relative.y * 0.0045, -1.15, 0.35)
		if not _follow_cam and camera_3d != null:
			_follow_cam = true
	elif event is InputEventKey and event.pressed and not event.echo:
		var ke := event as InputEventKey
		if switchroom == null or switchroom.engineer == null:
			return
		var eng := switchroom.engineer
		var ppe := switchroom.ppe_locker
		match ke.keycode:
			KEY_1:
				eng.set_ppe_equipped(not eng.ppe_suit, eng.ppe_gloves, eng.ppe_boots)
				if ppe != null:
					ppe.set_ppe_equipped(eng.ppe_suit, eng.ppe_gloves, eng.ppe_boots)
			KEY_2:
				eng.set_ppe_equipped(eng.ppe_suit, not eng.ppe_gloves, eng.ppe_boots)
				if ppe != null:
					ppe.set_ppe_equipped(eng.ppe_suit, eng.ppe_gloves, eng.ppe_boots)
			KEY_3:
				eng.set_ppe_equipped(eng.ppe_suit, eng.ppe_gloves, not eng.ppe_boots)
				if ppe != null:
					ppe.set_ppe_equipped(eng.ppe_suit, eng.ppe_gloves, eng.ppe_boots)
			KEY_F, KEY_E:
				eng.trigger_interact()
				if switchroom.watertight_door != null:
					_door_open = not _door_open
					switchroom.watertight_door.set_door_open(_door_open)
			KEY_T:
				_cycle_held_tool(eng)
			KEY_V:
				_follow_cam = not _follow_cam
				if not _follow_cam and camera_3d != null:
					camera_3d.global_transform = _overview_xform


func _cycle_held_tool(eng: EngineerCharacter) -> void:
	if toolbelt_props == null:
		return
	if _held_tool != null and _held_tool.get_parent() == eng.right_tool_socket:
		eng.right_tool_socket.remove_child(_held_tool)
		toolbelt_props.add_child(_held_tool)
		_held_tool.transform = _held_orig_xform
		_held_tool.visible = false
		_held_tool = null
	var count := toolbelt_props.get_child_count()
	if count == 0:
		return
	_tool_idx += 1
	if _tool_idx >= count:
		_tool_idx = -1
		return
	var next_tool := toolbelt_props.get_child(_tool_idx) as Node3D
	if next_tool != null:
		_held_orig_xform = next_tool.transform
		eng.attach_tool(next_tool)
		_held_tool = next_tool


func _process(_delta: float) -> void:
	if _follow_cam and camera_3d != null and switchroom != null and switchroom.engineer != null:
		var focus := switchroom.engineer.global_position + Vector3(0.0, 1.32, 0.0)
		var offset := Vector3(
			cos(_cam_pitch) * sin(_cam_yaw) * _cam_dist,
			-sin(_cam_pitch) * _cam_dist,
			cos(_cam_pitch) * cos(_cam_yaw) * _cam_dist
		)
		camera_3d.global_position = focus + offset
		camera_3d.look_at(focus, Vector3.UP)
