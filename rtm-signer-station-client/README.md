# RTM Signer Station Client — candidato sintético v1

Este corte crea únicamente un descriptor público del puesto Windows. No lo
convierte en un cliente atestado y no abre REG, lee documentos, accede al
certificado, firma ni presenta.

```bat
cd rtm-signer-station-client
node cli.mjs init --label "PC firma RTM"
node cli.mjs show
node --test tests/*.test.mjs
```

El descriptor se guarda en
`%LOCALAPPDATA%\RTM\SignerStation\station-candidate.json`. No contiene secreto,
material de certificado ni datos de expedientes. Su huella sirve solo para
registrar un candidato ligado a la sesión y al dispositivo RTM. La activación
real exige una atestación independiente que todavía permanece cerrada.
