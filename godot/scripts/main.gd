extends Node3D

@onready var hv_sim: HvSimCore = $HvSimCore
@onready var switchroom: Switchroom = $Switchroom
@onready var toolbelt_props: Node3D = $ToolbeltProps


func _ready() -> void:
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
				tool_names.append(child.name)
		print("ToolbeltProps ready with %d tools: %s" % [tool_names.size(), ", ".join(tool_names)])
