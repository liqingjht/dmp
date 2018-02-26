#!/bin/bash

p() {
	echo -e ">>> ${1}\n";
}

pNode() {
	printf "\nHow to install node.js?\n\n"
	printf "  %s\n\n" \
		"1. download node.js binary for linux from internet" \
		"2. xz -d node-vxx.xz" \
		"3. cd node-vxxx.tar" \
		"4. tar -xvf node-vxxx.tar" \
		"5. ln -s ./node-vxxx/bin/node /usr/sbin/node (example)" \
		"6. chmod +x /usr/sbin/node"
}

dmp -h >/dev/null 2>&1

if [ $? -eq 0 ]; then
	p "You have installed dmp before. Install it by manual if you need"
	p "Don't forget to backup ./mailFolder to save time downloading mails from server"
	exit
fi

nodeVer=`node -v 2>/dev/null`

if [ ! $? -eq 0 ]; then
	p "Please install node.js firstly"
	pNode
	exit
else
	nodeVer=${nodeVer:1}
	nodeVer=`echo $nodeVer |awk -F '.' '{print $1"."$2}'`
	lowVer=`echo "$nodeVer < 8.9" | bc`
	if [ $lowVer -eq 1 ]; then
		p 'Please update your node version up to 8.9'
		exit
	fi
fi

nodePath=`which node`

echo -e "#!$nodePath\n" > ./dmp-t.js

cat ./dmp.js | tail -n +2 >> ./dmp-t.js

mv ./dmp-t.js ./dmp.js

path=${nodePath%/*}

rm -f $path/dmp

ln -s `pwd`/dmp.js $path/dmp

chmod +x $path/dmp

dmp -h >/dev/null 2>&1

if [ $? -eq 0 ]; then
	p "Install dmp successfully, run 'dmp -h' to get usage or read README for help"
else
	p "Insatll dmp failed"
fi


