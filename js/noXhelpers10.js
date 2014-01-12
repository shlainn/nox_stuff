$(document).ready(function(){
    $("[id^='show_']").click(function() {
        var listId = this.id.substr(5, this.id.length);
        $('#'+listId).fadeIn();
    });

    $("[id^='hide_']").click(function() {
        var listId = this.id.substr(5, this.id.length);
        $('#'+listId).fadeOut();
    });

    $("[id^='showOverlay_']").click(function() {
        var listId = this.id.substr(12, this.id.length);
        $('#'+listId).fadeIn();
        $('#darkenPage').fadeIn();
        $('#topHeader').css("z-index", 0);
    });

    $("[id^='hideOverlay_']").click(function() {
        var listId = this.id.substr(12, this.id.length);
        $('#'+listId).fadeOut();
        $('#darkenPage').fadeOut();
        $('#topHeader').css("z-index", 51);
    });

    $("img[id='helpButton']").click(function() {
        openHelp(window.location.toString());
    });

    $("img[id='messageSignalButton']").click(function() {
        window.location="com_messages.php";
    });

    $("img[id='messageSignalUnionButton']").click(function() {
        window.location="com_union.php?category=Communication";
    });
    
    // tooltips
    // Select all anchor tag with rel set to tooltip
    $('[rel^="tooltip"]').mouseover(function(e) {
         
        var length = this.id.length;
        var tipId = this.id.substr(10, length);
        $('#tooltip_'+tipId).removeClass('hidden');
        adjustPosition(e, tipId);
         
    }).mousemove(function(e) {
        
        var length = this.id.length;
        var tipId = this.id.substr(10, length);
     
        // Keep changing the X and Y axis for the tooltip, thus, the tooltip move along with the mouse
        adjustPosition(e, tipId);
         
    }).mouseout(function() {
     
        // Remove the appended tooltip template
        var length = this.id.length;
        var tipId = this.id.substr(10, length);

        $("#tooltip_"+tipId).addClass('hidden');
         
    });
});

function adjustPosition(e, tipId)
{
    //Set the X and Y axis of the tooltip
    var whichInfo = tipId.substr(0, 5);
    var height = $('#tooltip_'+tipId).height();
    var width = $('#tooltip_'+tipId).width();

    var viewWidth = $(window).width();
    var gameWidth = $('#gameBody').width();
    var diffX = Math.max(0, viewWidth - gameWidth);
    var left, top;
    
    var x = e.pageX;
    var y = e.pageY;
    
    switch (whichInfo)
    {
        // display fleet info and defense complex weapon to the right
        case 'fleet':
        case 'weapo':
            left = x - diffX/2 + 20;
            top = y - height;
            break;

        // display repair info to the left
        default:
            left = x - diffX/2 - width - 10;
            top = y - height;
            break;
    }

    $('#tooltip_'+tipId).css('top', top);
    $('#tooltip_'+tipId).css('left', left);
}

function increaseCount(id, max)
{
    // input fields
    var inputField = true;
    var value = parseInt($("#"+id).val());
    
    // NaN for SPAN text fields - try to use text()
    if (isNaN(value))
    {
        value = parseInt($("#"+id).text());
        inputField = false;
    }

    if (!isNaN(value))
    {
        if (value < max)
            value++;

        if (inputField == true)
            $("#"+id).val(value);
        else
            $("#"+id).text(value);
    }
 }

function decreaseCount(id, min)
{
    // input fields
    var inputField = true;
    var value = parseInt($("#"+id).val());

    // NaN for SPAN text fields - try to use text()
    if (isNaN(value))
    {
        value = parseInt($("#"+id).text());
        inputField = false;
    }

    if (!isNaN(value))
    {
        if (value > min)
            value--;

        if (inputField == true)
            $("#"+id).val(value);
        else
            $("#"+id).text(value);
    }
}

function increaseProcessingResidents(id, max)
{
    // processing machine area (or other id)
    increaseCount(id, max);

    // specialist area
    var maxResidents = parseInt($("#residentsQuantity").text());
    increaseCount('residentsUsed', maxResidents);
}

function decreaseProcessingResidents(id, min)
{
    // processing machine area (or other id)
    decreaseCount(id, min);

    // specialist area
    decreaseCount('residentsUsed', min);
}

function jumpToGalaxy(formid)
{
    var myindex=formid.galaxies.selectedIndex;
    top.location.href="mil_mapSpace.php?galaxySelection="+formid.galaxies.options[myindex].value;
}

function jumpToHelp(formid)
{
    var myindex=formid.topics.selectedIndex;
    var referer = formid.topics.options[myindex].value;
    openHelp(referer);
}

function openHelp(referer)
{
    var helpUrl = "./help.php?id="+referer;
    HelpWindow = window.open(helpUrl,"Help","dependent=yes,dialog=yes,close=no,menubar=no,locationbar=no,scrollbars=yes,status=no,toolbar=no,location=no,resizable=yes,status=no,width=660,height=480");
    HelpWindow.focus();
}

function setPositionValues(x, y)
{
    // do nothing if position is undefined
    if (x == '-')
        return;
    
    var refPosX;
    var refPosY;

    // construction type is set if we are in the contect of a building construction
    var refConstructionType = $("input[name='constructionType']");
    if (refConstructionType.length > 0)
    {
        var constructionType = refConstructionType.val();
        if (constructionType == 'New')
        {
            refPosX = $("input[name='posX']");
            refPosY = $("input[name='posY']");
        }
        else
        {
            refPosX = $("input[name='posXUp']");
            refPosY = $("input[name='posYUp']");
        }
    }
    else
    {
        refPosX = $("input[name='posX']");
        refPosY = $("input[name='posY']");
    }

    // switch off old hilight in imagemap first
    if (refPosX.val() != '-')
    {
        var jQOldId = "#id_"+refPosX.val()+"_"+refPosY.val();
        var dataOld = $(jQOldId).data('maphilight') || {};
        dataOld.alwaysOn = false;
        dataOld.fill = false;
        $(jQOldId).data('maphilight', dataOld).trigger('alwaysOn.maphilight');
    }

    refPosX.val(x);
    refPosY.val(y);

    // hilight new area in imagemap
    var jQId = "#id_"+x+"_"+y;
    var data = $(jQId).data('maphilight') || {};
    data.alwaysOn = true;
    data.fill = true;
    $(jQId).data('maphilight', data).trigger('alwaysOn.maphilight');

    // after setting the position let's activate the action button
    // ==> this is valid for fleet missions
    var refActionButton = $("#actionButton");
    if (refActionButton.length > 0)
        refActionButton.removeClass('hidden');

    // ==> this is valid for building construction
    var refBuildButton = $("#buildButton");
    if (refBuildButton.length > 0)
        updateBuildingCalculation();

    var refSelectInMapSpan = $("#selectInMap");
    if (refSelectInMapSpan.length > 0)
        refSelectInMapSpan.addClass('hidden');
}

function getNoxDateFormat(duration, format)
{
    var jetzt = new Date();
    var noxDate = format;
    var date = new Date();
    date.setTime(jetzt.getTime() + duration);
    
    var year = date.getUTCFullYear();
    var month = date.getMonth() + 1;
    if (month < 10)
        month = '0' + month;
    var day = date.getDate();
    if (day < 10)
        day = '0' + day;
    var hour = date.getHours();
    if (hour < 10)
        hour = '0' + hour;
    var minute = date.getMinutes();
    if (minute < 10)
        minute = '0' + minute;
    var second = date.getSeconds();
    if (second < 10)
        second = '0' + second;
    noxDate = noxDate.replace('%Y', year);
    noxDate = noxDate.replace('%m', month);
    noxDate = noxDate.replace('%d', day);
    noxDate = noxDate.replace('%H', hour);
    noxDate = noxDate.replace('%M', minute);
    noxDate = noxDate.replace('%S', second);
    
    return noxDate;
}

function getNoxDurationDays(duration)
{
    var days = Math.floor(duration / 86400);
    var rest = duration - days*86400;
    var hours = Math.floor(rest/3600);
    rest = rest - hours*3600;
    var minutes = Math.floor(rest/60);
    var seconds = Math.round(rest - minutes*60);

    if (hours < 10)
        hours = '0'+hours;
    if (minutes < 10)
        minutes = '0'+minutes;
    if (seconds < 10)
        seconds = '0'+seconds;

    return days;
}

function getNoxDurationHMS(duration)
{
    var days = Math.floor(duration / 86400);
    var rest = duration - days*86400;
    var hours = Math.floor(rest/3600);
    rest = rest - hours*3600;
    var minutes = Math.floor(rest/60);
    var seconds = Math.round(rest - minutes*60);

    if (hours < 10)
        hours = '0'+hours;
    if (minutes < 10)
        minutes = '0'+minutes;
    if (seconds < 10)
        seconds = '0'+seconds;

    return hours+':'+minutes+':'+seconds;
}

function swapOn(id, active)
{
    if (active === 1)
        return;
    
    var ref = document.getElementById(id);
    ref.src = String(ref.src).replace(/_off\./,"_on.");
}
function swapOff(id, active)
{
    if (active === 1)
        return;
    
    var ref = document.getElementById(id);
    ref.src = String(ref.src).replace(/_on\./,"_off.");
}
