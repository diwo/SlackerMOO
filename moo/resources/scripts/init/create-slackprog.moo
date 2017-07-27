@create #1 named SlackProgram,slackprog
;add_property(#0, "slackprog", $string_utils:match_object("slackprog", me), {me, "rc"})

@verb $slackerbot:= any any any
@program $slackerbot:=
$slackprog:exec(@args);
.

@verb $slackprog:exec this none this
@program $slackprog:exec
{channelId, channelName, userName, userFirstName, @command} = args;
msg = "You issued command '" + command[1] + "' with args: ";
for i in [2..length(command)]
  if (index(command[i], " ") > 0)
    command[i] = "'" + command[i] + "'";
  endif
endfor
msg = msg + $string_utils:english_list(command[2..$]);
$slackerbot:channel(channelId, msg);
.

@verb $slackerbot:channel this none this
@program $slackerbot:channel
$slackerbot:tell($string_utils:from_list({"#SLACK#", @args}, " "));
.
