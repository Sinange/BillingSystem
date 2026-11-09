/system script add name=render-billing-sync policy=read,write,test source={
    :local apiUrl "https://billingsystem-v6r7.onrender.com/router"
    :local apiToken "REPLACE_WITH_LONG_RANDOM_TOKEN"
    :local response [/tool fetch url=($apiUrl . "/pending") http-header-field=("Authorization: Bearer " . $apiToken) output=user as-value]
    :local jobs [:deserialize from=json value=($response->"data")]

    :foreach job in=$jobs do={
        :local checkoutId ($job->"checkoutRequestID")
        :local mac ($job->"macAddress")
        :local action ($job->"action")

        :if ($action = "grant") do={
            :local bindings [/ip hotspot ip-binding find where mac-address=$mac and type=bypassed]
            :if ([:len $bindings] = 0) do={
                /ip hotspot ip-binding add mac-address=$mac type=bypassed comment=("Paid transaction " . $checkoutId)
            }
        }

        :if ($action = "expire") do={
            :foreach bindingId in=[/ip hotspot ip-binding find where mac-address=$mac and type=bypassed] do={
                /ip hotspot ip-binding remove $bindingId
            }
            :foreach sessionId in=[/ip hotspot active find where mac-address=$mac] do={
                /ip hotspot active remove $sessionId
            }
            :foreach hostId in=[/ip hotspot host find where mac-address=$mac] do={
                /ip hotspot host remove $hostId
            }
        }

        :local ackData ("{\"checkoutRequestID\":\"" . $checkoutId . "\",\"action\":\"" . $action . "\"}")
        /tool fetch url=($apiUrl . "/ack") http-method=post http-header-field=("Authorization: Bearer " . $apiToken . ",Content-Type: application/json") http-data=$ackData output=user
    }
}
/system scheduler add name=render-billing-sync interval=5s on-event="/system script run render-billing-sync" policy=read,write,test
