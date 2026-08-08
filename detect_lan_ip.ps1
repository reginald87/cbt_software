# Detects the active LAN IPv4 address for the CBT server.
# Picks the physical adapter that is Up and has a real default gateway,
# excluding VPNs and Hyper-V virtual switches (gateway 0.0.0.0 or none).
$adapter = Get-NetIPConfiguration |
    Where-Object {
        $_.NetAdapter.Status -eq 'Up' -and
        $_.IPv4DefaultGateway -and
        $_.IPv4DefaultGateway.NextHop -ne '0.0.0.0'
    } |
    Sort-Object -Property @{ Expression = { $_.NetAdapter.ifIndex } } |
    Select-Object -First 1

if ($adapter -and $adapter.IPv4Address) {
    ($adapter.IPv4Address | Select-Object -First 1).IPAddress
}
