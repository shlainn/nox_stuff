function timeLeftStart()
{
    var dnow = new Date();
    if (TimeOffset != 0)
        dnow = new Date(dnow.getTime() + TimeOffset*1000);

    // buildings
    try
    {
        for (var i=0; i<BldIds.length; i++)
        {
            var idDays = BldIds[i] + "_days";
            var idHMS = BldIds[i] + "_HMS";
            var idUnit = BldIds[i] + "_unit";

            // building finished?
            if ($("span[id='" + idUnit + "']").text() == BldFinishText)
                continue;

            var timeLeft = BldFinishTimes[i] - Math.round(dnow/1000);
            var timeLeftDays = Math.floor(timeLeft/86400);
            var timeLeftHMS = GetHMS(timeLeft);

            if (timeLeft <= 0)
            {
                $("span[id='" + idDays + "']").text("");
                $("span[id='" + idHMS + "']").text("");
                $("span[id='" + idUnit + "']").text(BldFinishText);
                var thisTimerIdx = BldIds[i].substr("bldTimer_".length);
                var thisTimerId = "show_bldDelId_" + thisTimerIdx;
                $("#"+thisTimerId).addClass('hidden');
            }
            else
            {
                $("span[id='" + idDays + "']").text(timeLeftDays);
                $("span[id='" + idHMS + "']").text(timeLeftHMS);
            }
        }
    }
    catch (err)
    {
        err = err;
    }

    // manpower actions
    try
    {
        for (var m=0; m<ManIds.length; m++)
        {
            idDays = ManIds[m] + "_days";
            idHMS = ManIds[m] + "_HMS";
            idUnit = ManIds[m] + "_unit";

            // manpower action finished?
            if ($("span[id='" + idUnit + "']").text() == ManFinishText)
                continue;

            timeLeft = ManFinishTimes[m] - Math.round(dnow/1000);
            timeLeftDays = Math.floor(timeLeft/86400);
            timeLeftHMS = GetHMS(timeLeft);

            if (timeLeft <= 0)
            {
                $("span[id='" + idDays + "']").text("");
                $("span[id='" + idHMS + "']").text("");
                $("span[id='" + idUnit + "']").text(ManFinishText);
            }
            else
            {
                $("span[id='" + idDays + "']").text(timeLeftDays);
                $("span[id='" + idHMS + "']").text(timeLeftHMS);
            }
        }
    }
    catch (err)
    {
        err = err;
    }

    // research actions
    try
    {
        for (var r=0; r<ResearchIds.length; r++)
        {
            idDays = ResearchIds[r] + "_days";
            idHMS = ResearchIds[r] + "_HMS";
            idUnit = ResearchIds[r] + "_unit";

            // research action finished?
            if ($("span[id='" + idUnit + "']").text() == ResearchFinishText)
                continue;

            timeLeft = ResearchFinishTimes[r] - Math.round(dnow/1000);
            timeLeftDays = Math.floor(timeLeft/86400);
            timeLeftHMS = GetHMS(timeLeft);

            if (timeLeft <= 0)
            {
                $("span[id='" + idDays + "']").text("");
                $("span[id='" + idHMS + "']").text("");
                $("span[id='" + idUnit + "']").text(ResearchFinishText);
            }
            else
            {
                $("span[id='" + idDays + "']").text(timeLeftDays);
                $("span[id='" + idHMS + "']").text(timeLeftHMS);
            }
        }
    }
    catch (err)
    {
        err = err;
    }

    // spaceships
    try
    {
        for (var j=0; j<ShipIds.length; j++)
        {
            idDays = ShipIds[j] + "_days";
            idHMS = ShipIds[j] + "_HMS";
            idUnit = ShipIds[j] + "_unit";

            // spaceship finished?
            if ($("span[id='" + idUnit + "']").text() == ShipFinishText)
                continue;

            timeLeft = ShipFinishTimes[j] - Math.round(dnow/1000);
            timeLeftDays = Math.floor(timeLeft/86400);
            timeLeftHMS = GetHMS(timeLeft);

            if (timeLeft <= 0)
            {
                $("span[id='" + idDays + "']").text("");
                $("span[id='" + idHMS + "']").text("");
                $("span[id='" + idUnit + "']").text(ShipFinishText);
            }
            else
            {
                $("span[id='" + idDays + "']").text(timeLeftDays);
                $("span[id='" + idHMS + "']").text(timeLeftHMS);
            }
        }
    }
    catch (err)
    {
        err = err;
    }

    // travelling fleets
    try
    {
        for (var k=0; k<FleetTravelIds.length; k++)
        {
            idDays = FleetTravelIds[k] + "_days";
            idHMS = FleetTravelIds[k] + "_HMS";
            idUnit = FleetTravelIds[k] + "_unit";

            // fleet reached position?
            if ($("span[id='" + idHMS + "']").text() == FleetTravelFinishText)
                continue;

            timeLeft = FleetTravelFinishTimes[k] - Math.round(dnow/1000);
            timeLeftDays = Math.floor(timeLeft/86400);
            timeLeftHMS = GetHMS(timeLeft);

            if (timeLeft <= 0)
            {
                $("span[id='" + idDays + "']").text("");
                $("span[id='" + idUnit + "']").text("");
                $("span[id='" + idHMS + "']").text(FleetTravelFinishText);
                $("span[id='" + idHMS + "']").addClass('enoughResources');
            }
            else
            {
                if(timeLeftDays > 0)
                {
                    $("span[id='" + idDays + "']").show();
                    $("span[id='" + idUnit + "']").show();
                    $("span[id='" + idDays + "']").text(timeLeftDays);
                }
                else
                {
                    $("span[id='" + idDays + "']").hide();
                    $("span[id='" + idUnit + "']").hide();
                }
                $("span[id='" + idHMS + "']").text(timeLeftHMS);
            }
        }
    }
    catch (err)
    {
        err = err;
    }

    setTimeout("timeLeftStart()", 1000);
}

function GetHMS(timestamp)
{
    var days = Math.floor(timestamp / 86400);
    var rest = timestamp - days*86400;
    if (rest < 0)
        return "00:00:00";

    var hours = Math.floor(rest/3600);
    rest = rest - hours*3600;
    var minutes = Math.floor(rest/60);
    var seconds = rest - minutes*60;

    if (hours < 10)
        hours = '0' + hours;
    if (minutes < 10)
        minutes = '0' + minutes;
    if (seconds < 10)
        seconds = '0' + seconds;
    return hours + ':' + minutes + ':' + seconds;
}