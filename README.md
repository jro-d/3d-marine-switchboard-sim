# Marine HV 6.6 kV Switchboard — Walkable 3D Simulator

Playable 3D Marine Electro-Technical Officer (ETO) High Voltage Switchroom simulator built with Three.js and Vite, implementing IEC 60092-503 interlocks, MCA COSWP Ch. 22 safe isolation, and STCW Table A-III/6 switching missions.

## Development & Build

```bash
npm install
npm run dev      # Start Vite dev server
npm run build    # Bundle into dist/
npm test         # Run Node unit & server tests (expects dist/)
npm run lint     # Verify JS syntax across modules
npm start        # Serve dist/ via Express (http://127.0.0.1:3000)
```

## Controls (3D Switchroom)

- **Move**: `W A S D` or Arrow Keys (`Shift` to sprint)
- **Look**: Click and drag in 3rd-person, or move pointer in 1st-person (`[V]` toggles camera mode)
- **Interact**: `[E]` or station action cards; click open cubicle HV/PE terminals directly in 3D when proving dead (`[7]` 6.6 kV wand) or fitting CME leads (`[8]`)
- **Toolbelt**: Number keys `1`–`0`
- **Auto-walk**: `[F]` walks to the next LOTO objective station
- **Station cycle**: `[Tab]` cycles nearby stations, `[X]` opens the current bay door
