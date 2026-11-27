extends CharacterBody3D
class_name EngineerCharacter

const WALK_SPEED := 2.4
const SPRINT_SPEED := 4.2
const ROT_SPEED := 10.0
const GRAVITY := 9.8

@export var ppe_suit: bool = false
@export var ppe_gloves: bool = false
@export var ppe_boots: bool = false

@onready var model: Node3D = $Model
@onready var anim_tree: AnimationTree = get_node_or_null("AnimationTree") as AnimationTree
@onready var right_hand_attachment: BoneAttachment3D = get_node_or_null("RightHandAttachment") as BoneAttachment3D
@onready var right_tool_socket: Node3D = get_node_or_null("RightHandAttachment/RigRightToolSocket") as Node3D

var skeleton: Skeleton3D
var anim_player: AnimationPlayer
var state_playback: AnimationNodeStateMachinePlayback

var body_mesh: Node3D
var left_bare_hand: Node3D
var right_bare_hand: Node3D
var left_hv_glove: Node3D
var right_hv_glove: Node3D
var hard_hat: Node3D
var arc_coat: Node3D
var arc_hood: Node3D
var left_hv_sole: Node3D
var right_hv_sole: Node3D

var active_clip: String = "Idle"
var _interact_timer: float = 0.0


func _ready() -> void:
	if model == null:
		return

	skeleton = model.find_child("Skeleton3D", true, false) as Skeleton3D
	anim_player = model.find_child("AnimationPlayer", true, false) as AnimationPlayer

	body_mesh = _find_part("EngineerBody", "EngineerBodyMesh")
	left_bare_hand = _find_part("EngineerLeftBareHand")
	right_bare_hand = _find_part("EngineerRightBareHand")
	left_hv_glove = _find_part("EngineerLeftHvGlove")
	right_hv_glove = _find_part("EngineerRightHvGlove")
	hard_hat = _find_part("EngineerHardHat")
	arc_coat = _find_part("EngineerArcSuitCoat")
	arc_hood = _find_part("EngineerArcHood")
	left_hv_sole = _find_part("EngineerLeftHvSole")
	right_hv_sole = _find_part("EngineerRightHvSole")

	if right_hand_attachment != null and skeleton != null:
		right_hand_attachment.use_external_skeleton = true
		right_hand_attachment.external_skeleton = right_hand_attachment.get_path_to(skeleton)
		right_hand_attachment.bone_name = "RightHand"
		right_hand_attachment.on_skeleton_update()

	if anim_player != null:
		for clip_name in ["Idle", "Walk", "Sprint", "Interact", "PushTrolley"]:
			if anim_player.has_animation(clip_name):
				var anim := anim_player.get_animation(clip_name)
				if anim != null:
					anim.loop_mode = Animation.LOOP_LINEAR
		if anim_tree != null:
			anim_tree.anim_player = anim_tree.get_path_to(anim_player)
			anim_tree.active = true
			state_playback = anim_tree.get("parameters/playback") as AnimationNodeStateMachinePlayback

	set_ppe_equipped(ppe_suit, ppe_gloves, ppe_boots)
	play_clip("Idle")


func _find_part(primary: String, fallback: String = "") -> Node3D:
	var n := model.find_child(primary, true, false) as Node3D
	if n == null and fallback != "":
		n = model.find_child(fallback, true, false) as Node3D
	return n


func set_ppe_equipped(suit: bool, gloves: bool, boots: bool) -> void:
	ppe_suit = suit
	ppe_gloves = gloves
	ppe_boots = boots

	if arc_coat != null:
		arc_coat.visible = suit
	if arc_hood != null:
		arc_hood.visible = suit
	if hard_hat != null:
		hard_hat.visible = not suit

	if left_hv_glove != null:
		left_hv_glove.visible = gloves
	if right_hv_glove != null:
		right_hv_glove.visible = gloves
	if left_bare_hand != null:
		left_bare_hand.visible = not gloves
	if right_bare_hand != null:
		right_bare_hand.visible = not gloves

	if left_hv_sole != null:
		left_hv_sole.visible = boots
	if right_hv_sole != null:
		right_hv_sole.visible = boots


func play_clip(clip_name: String) -> void:
	active_clip = clip_name
	if state_playback != null:
		state_playback.travel(clip_name)
	elif anim_player != null and anim_player.has_animation(clip_name):
		anim_player.play(clip_name, 0.18)


func get_available_clips() -> PackedStringArray:
	if anim_player == null:
		return PackedStringArray()
	return anim_player.get_animation_list()


func attach_tool(tool_node: Node3D) -> void:
	if right_tool_socket == null or tool_node == null:
		return
	var old_parent := tool_node.get_parent()
	if old_parent != null:
		old_parent.remove_child(tool_node)
	right_tool_socket.add_child(tool_node)
	tool_node.position = Vector3.ZERO
	tool_node.rotation = Vector3.ZERO
	tool_node.visible = true


func trigger_interact(duration: float = 1.6) -> void:
	_interact_timer = max(_interact_timer, duration)
	play_clip("Interact")


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	if _interact_timer > 0.0:
		_interact_timer = max(0.0, _interact_timer - delta)

	var input_vec := Vector2.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input_vec.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input_vec.y += 1.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input_vec.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input_vec.x += 1.0

	if input_vec.length_squared() > 0.01:
		var dir := Vector3(input_vec.x, 0.0, input_vec.y).normalized()
		var sprinting := Input.is_key_pressed(KEY_SHIFT)
		var spd := SPRINT_SPEED if sprinting else WALK_SPEED
		velocity.x = dir.x * spd
		velocity.z = dir.z * spd
		var target_yaw := atan2(dir.x, dir.z)
		rotation.y = lerp_angle(rotation.y, target_yaw, min(1.0, ROT_SPEED * delta))
		if _interact_timer <= 0.0:
			play_clip("Sprint" if sprinting else "Walk")
	else:
		velocity.x = move_toward(velocity.x, 0.0, 12.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 12.0 * delta)
		if _interact_timer <= 0.0:
			play_clip("Idle")

	move_and_slide()
