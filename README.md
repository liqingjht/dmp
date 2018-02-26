# dmp - download mail patch
download patch from server mail folder as eml or diff format with cli command

#### overview: ####

We should remote login windows server firstly, then use putty to login ubuntu to develop in remvoe window.

So if I receive a patch and I want to apply it to project, I need to do following steps:

> 1. save patch as eml file in thunderbird
> 2. using git bash to scp eml file to ubuntu server
> 3. cp eml file to project folder
> 4. git am or git apply to apply patch
> 5. check the modification

with dmp, I just typo 'dmp' in cli command and select which patch(es) I want to download, then it done.

I can also check the patch as diff format with 'dmp -p'

----------

<b>I. How to install?</b>

>make sure your server has installed node.js and it's version >= 8.9

>unzip dmp-Vx.x.x.zip; cd dmp-Vx.x.x

3. chmod +x install.sh
4. ./install.sh

or

3. modify 'dmp.js' first line to your node.js PATH
4. create link in your $PATH folder to dmp.js, like 'ln -s /xxx/dmp.js /usr/sbin/dmp'
5. chmod +x dmp
6. then you can run command 'dmp' everywhere

---------------------------

<b>II. How to use?</b>

1. run command 'dmp' in your git repository
2. if it's the first time you use this tool, it will ask your dniserver username and password
3. waiting the tool download mails from dniserver (it will take some time if it's the first time you use it)
4. select the project name or input some characters to search
5. press 'space' to select patch and 'enter' to download patch

---------------------------

<b>III. What should I know?</b>

1. dmp means 'download mail patch', wrote by defeng.liu at 2018-02-01
2. run 'dmp -h' or whatever options except -r, -p, --reset and --parseMail can trigger print help message
3. the tool will store your dniserver username and password, the location is ./.configuration, it
  has been encorded but it's easy to decode.
4. run 'dmp -r' or 'dmp --reset' to clear configuration of username and password
5. run 'dmp -p' or 'dmp --parseMail' will parse the mail to patch format
6. the tool download mails from dniserver by ssh connection, and will sync files with dniserver, it
  means it will download new mails and delete expired mails.
7. if there is new version of dmp, backup ./.configuration and ./mailFolder if you need.

---------------------------

<b>IV. What else to do?</b>

1. mark patches you have downloaded
2. save mailinfo to datebase to save time
<br/>
...


